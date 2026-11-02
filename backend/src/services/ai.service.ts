import prisma from "../lib/prisma";
import { chatCompletion, ChatMessage, ToolDefinition } from "../lib/openrouter";
import { InvalidDataProvidedError } from "../lib/errors";
import { PropertyType } from "../generated/prisma/enums";
import { asEnum, isPlainObject } from "../lib/validate";
import { parseListingFilters, findListingsForRanking, getListingById, SORT_OPTIONS, ListingFilters } from "./listing.service";
import { findPreferences } from "./preferences.service";
import { rankListings } from "./ranking.service";
import { serializeListing } from "../lib/serialize";

const MAX_QUERY_LENGTH = 500;
const MAX_HISTORY_MESSAGES = 10;
const RESULTS_LIMIT = 10;

// ---------- Tool (function calling) definition ----------
// The LLM never touches the database. It only fills in these arguments,
// then OUR code validates them (same parser as GET /listings) and runs the query.

const SEARCH_TOOL: ToolDefinition = {
    type: "function",
    function: {
        name: "search_listings",
        description: "Search rental listings. Fill in only the filters the user actually asked for.",
        parameters: {
            type: "object",
            properties: {
                summary: { type: "string", description: "One short sentence in the user's language describing what you understood" },
                city: { type: "string", description: "City name in Polish, e.g. Wrocław, Poznań, Kraków" },
                neighborhood: { type: "string", description: "District / neighborhood name" },
                propertyType: { type: "string", enum: Object.values(PropertyType) },
                minPrice: { type: "number", description: "Monthly rent in PLN" },
                maxPrice: { type: "number", description: "Monthly rent in PLN" },
                minRooms: { type: "integer" },
                maxRooms: { type: "integer" },
                minArea: { type: "number", description: "Square meters" },
                maxArea: { type: "number", description: "Square meters" },
                petsAllowed: { type: "boolean", description: "true only if the user has / wants a pet" },
                smokingAllowed: { type: "boolean" },
                furnished: { type: "boolean" },
                hasBalcony: { type: "boolean" },
                hasParking: { type: "boolean" },
                hasElevator: { type: "boolean" },
                utilitiesIncluded: { type: "boolean", description: "Rent already includes bills" },
                remoteWorkFriendly: { type: "boolean", description: "User works from home / needs a quiet workspace" },
                availableFrom: { type: "string", description: "ISO date YYYY-MM-DD the user wants to move in by" },
                sort: { type: "string", enum: [...SORT_OPTIONS] },
            },
            required: ["summary"],
        },
    },
};

function buildSystemPrompt(cities: string[]): string {
    const today = new Date().toISOString().slice(0, 10);
    return [
        "You are RentMate, an assistant that helps people find a rental apartment in Poland.",
        `Today is ${today}. Cities we have listings in: ${cities.join(", ") || "none"}.`,
        "When the user describes what they are looking for, ALWAYS call search_listings.",
        "Translate vague words into filters: 'cheap' -> a reasonable maxPrice for the city, 'with a dog' -> petsAllowed=true,",
        "'I work from home' -> remoteWorkFriendly=true, 'from next month' -> availableFrom = first day of next month.",
        "If the user refines a previous search (e.g. 'cheaper', 'and with a balcony'), keep the previous filters and change only what they asked.",
        "If the message is not about finding housing, answer briefly without calling the tool.",
    ].join("\n");
}

// Client keeps the conversation and sends it back (stateless "memory").
// We only accept plain user/assistant text messages - never system or tool messages from the client.
function parseHistory(raw: unknown): ChatMessage[] {
    if (!Array.isArray(raw)) return [];
    const history: ChatMessage[] = [];
    for (const item of raw.slice(-MAX_HISTORY_MESSAGES)) {
        if (!isPlainObject(item) || typeof item.content !== "string") continue;
        if (item.role === "user" || item.role === "assistant") {
            history.push({ role: item.role, content: item.content.slice(0, MAX_QUERY_LENGTH * 2) });
        }
    }
    return history;
}

// LLM output is untrusted input too. Invalid enum values are dropped instead of failing the request.
function sanitizeToolArguments(json: string): { filters: ListingFilters; summary: string; sort: string | undefined } {
    let args: unknown;
    try {
        args = JSON.parse(json);
    } catch {
        args = {};
    }
    if (!isPlainObject(args)) args = {};
    const raw = { ...(args as Record<string, unknown>) };

    if (raw.propertyType !== undefined && !asEnum(raw.propertyType, PropertyType)) delete raw.propertyType;
    delete raw.status; // the model must not search rented listings

    return {
        filters: parseListingFilters(raw),
        summary: typeof raw.summary === "string" ? raw.summary : "",
        sort: typeof raw.sort === "string" ? raw.sort : undefined,
    };
}

function sortListings<T extends { listing: { price: { toNumber(): number }; area: number; createdAt: Date } }>(items: T[], sort: string | undefined): T[] {
    const copy = [...items];
    if (sort === "price_asc") copy.sort((a, b) => a.listing.price.toNumber() - b.listing.price.toNumber());
    if (sort === "price_desc") copy.sort((a, b) => b.listing.price.toNumber() - a.listing.price.toNumber());
    if (sort === "area_desc") copy.sort((a, b) => b.listing.area - a.listing.area);
    return copy;
}

export async function aiSearch(body: unknown, userId: string | undefined) {
    if (!isPlainObject(body) || typeof body.query !== "string" || body.query.trim() === "") {
        throw new InvalidDataProvidedError("query is required");
    }
    const query = body.query.trim();
    if (query.length > MAX_QUERY_LENGTH) {
        throw new InvalidDataProvidedError(`query is too long (max ${MAX_QUERY_LENGTH} characters)`);
    }

    const cityRows = await prisma.listing.findMany({ distinct: ["city"], select: { city: true } });
    const messages: ChatMessage[] = [
        { role: "system", content: buildSystemPrompt(cityRows.map((row) => row.city)) },
        ...parseHistory(body.history),
    ];
    // Filters of the previous search (the frontend sends back what we returned last time),
    // so "cheaper" or "and with a balcony" can refine instead of starting from scratch
    if (isPlainObject(body.previousFilters)) {
        const previous = sanitizeToolArguments(JSON.stringify(body.previousFilters)).filters;
        messages.push({ role: "system", content: `Previous search filters: ${JSON.stringify(previous)}` });
    }
    messages.push({ role: "user", content: query });

    const message = await chatCompletion({ messages, tools: [SEARCH_TOOL], toolChoice: "auto" });
    const toolCall = message.tool_calls?.find((call) => call.function.name === "search_listings");

    // Model decided this is not a search (small talk, unrelated question)
    if (!toolCall) {
        return { query, filters: null, reply: message.content ?? "", total: 0, results: [] };
    }

    const { filters, summary, sort } = sanitizeToolArguments(toolCall.function.arguments);
    const listings = await findListingsForRanking(filters);

    // Logged-in user with a profile -> personalised ranking, otherwise neutral order
    const preferences = userId ? await findPreferences(userId) : null;
    const ranked = sortListings(rankListings(listings, preferences), sort).slice(0, RESULTS_LIMIT);

    const reply = listings.length === 0
        ? `${summary} Nothing matches exactly - try loosening a filter.`.trim()
        : `${summary} Found ${listings.length} listing(s).`.trim();

    return {
        query,
        filters,
        reply,
        personalized: preferences !== null,
        total: listings.length,
        results: ranked.map((item) => ({
            listing: serializeListing(item.listing),
            score: item.score,
            reasons: item.reasons,
            warnings: item.warnings,
        })),
    };
}

// ---------- Questions about one listing ----------
// The answer must be grounded in the listing data only (no invented facts).

export async function askAboutListing(listingId: string, body: unknown) {
    if (!isPlainObject(body) || typeof body.question !== "string" || body.question.trim() === "") {
        throw new InvalidDataProvidedError("question is required");
    }
    const question = body.question.trim();
    if (question.length > MAX_QUERY_LENGTH) {
        throw new InvalidDataProvidedError(`question is too long (max ${MAX_QUERY_LENGTH} characters)`);
    }

    const listing = serializeListing(await getListingById(listingId));
    // Only facts the tenant is allowed to see (no landlordId)
    const { landlordId: _landlordId, ...facts } = listing;

    const messages: ChatMessage[] = [
        {
            role: "system",
            content: [
                "You answer questions about ONE rental listing. Use ONLY the facts in the JSON below.",
                "If the answer is not in the data, say you don't know and suggest asking the landlord during a viewing.",
                "Answer in the language of the question, in 1-3 sentences. Prices are monthly, in PLN.",
                `Listing: ${JSON.stringify(facts)}`,
            ].join("\n"),
        },
        ...parseHistory(body.history),
        { role: "user", content: question },
    ];

    const message = await chatCompletion({ messages, temperature: 0 });
    return { listingId, question, answer: message.content ?? "" };
}
