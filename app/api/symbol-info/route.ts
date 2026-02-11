import { NextRequest, NextResponse } from "next/server";

type SymbolMetadata = {
  companyName: string;
  sector: string;
};

const SYMBOL_METADATA: Record<string, SymbolMetadata> = {
  AAPL: { companyName: "Apple Inc.", sector: "Technology" },
  MSFT: { companyName: "Microsoft Corporation", sector: "Technology" },
  GOOGL: { companyName: "Alphabet Inc.", sector: "Communication Services" },
  GOOG: { companyName: "Alphabet Inc.", sector: "Communication Services" },
  AMZN: { companyName: "Amazon.com, Inc.", sector: "Consumer Discretionary" },
  NVDA: { companyName: "NVIDIA Corporation", sector: "Technology" },
  META: { companyName: "Meta Platforms, Inc.", sector: "Communication Services" },
  TSLA: { companyName: "Tesla, Inc.", sector: "Consumer Discretionary" },
  "BRK.B": { companyName: "Berkshire Hathaway Inc.", sector: "Financials" },
  JPM: { companyName: "JPMorgan Chase & Co.", sector: "Financials" },
  XOM: { companyName: "Exxon Mobil Corporation", sector: "Energy" },
  JNJ: { companyName: "Johnson & Johnson", sector: "Health Care" },
  V: { companyName: "Visa Inc.", sector: "Financials" },
  WMT: { companyName: "Walmart Inc.", sector: "Consumer Staples" },
  PG: { companyName: "Procter & Gamble Company", sector: "Consumer Staples" },
  UNH: { companyName: "UnitedHealth Group Incorporated", sector: "Health Care" },
};

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim().toUpperCase() ?? "";

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required." }, { status: 400 });
  }

  const symbolDetails = SYMBOL_METADATA[symbol];

  if (!symbolDetails) {
    return NextResponse.json(
      { error: "No local company metadata available for this symbol yet." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    symbol,
    companyName: symbolDetails.companyName,
    sector: symbolDetails.sector,
  });
}
