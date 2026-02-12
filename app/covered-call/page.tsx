"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);

const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;
const formatPercentValue = (value: number) => `${value.toFixed(2)}%`;

type TradeQuality = {
  score: number;
  label: "Strong" | "Reasonable" | "Borderline" | "Weak";
  notes: string[];
  hasElevatedRiskWarning: boolean;
};

const evaluateTradeQuality = ({
  premiumPerDayPct,
  downsideToBreakEvenPct,
  upsideCapPct,
  totalReturnPct,
  impliedVolatilityPct,
}: {
  premiumPerDayPct: number;
  downsideToBreakEvenPct: number;
  upsideCapPct: number;
  totalReturnPct: number;
  impliedVolatilityPct: number;
}): TradeQuality => {
  let score = 50;
  const factorNotes: Array<{ impact: number; note: string }> = [];
  let hasElevatedRiskWarning = false;

  const addFactor = (impact: number, note: string) => {
    score += impact;
    factorNotes.push({ impact: Math.abs(impact), note });
  };

  if (premiumPerDayPct < 0.05) {
    addFactor(-15, "Premium/day is low");
  } else if (premiumPerDayPct < 0.12) {
    // neutral
  } else if (premiumPerDayPct <= 0.2) {
    addFactor(10, "Premium/day is attractive");
  } else {
    addFactor(15, "Premium/day is very high");
    hasElevatedRiskWarning = true;
  }

  if (downsideToBreakEvenPct < 2) {
    addFactor(-20, "Thin downside cushion");
  } else if (downsideToBreakEvenPct <= 5) {
    // neutral
  } else if (downsideToBreakEvenPct <= 8) {
    addFactor(10, "Downside cushion is solid");
  } else {
    addFactor(15, "Downside cushion is strong");
  }

  if (upsideCapPct < 1) {
    addFactor(-4, "Upside is tightly capped");
  } else if (upsideCapPct <= 3) {
    addFactor(-2, "Upside is somewhat capped");
    addFactor(-10, "Upside is very capped");
  } else if (upsideCapPct <= 3) {
    addFactor(-5, "Upside is capped");
  } else if (upsideCapPct <= 7) {
    addFactor(5, "Upside room is fair");
  } else {
    addFactor(10, "Upside room is healthy");
  }

  if (totalReturnPct < 8) {
    addFactor(-10, "Max return potential is limited");
  } else if (totalReturnPct < 12) {
    // neutral
  } else if (totalReturnPct <= 20) {
    addFactor(10, "Return potential is strong");
  } else if (totalReturnPct <= 35) {
    addFactor(15, "Return potential is very strong");
  } else {
    addFactor(20, "Return potential is exceptional");
  }

  if (impliedVolatilityPct < 15) {
    addFactor(-8, "IV is low for option income");
  } else if (impliedVolatilityPct <= 25) {
    // neutral
  } else if (impliedVolatilityPct <= 45) {
    addFactor(10, "IV supports stronger premium");
  } else if (impliedVolatilityPct <= 65) {
    addFactor(5, "IV is elevated");
    hasElevatedRiskWarning = true;
  } else {
    addFactor(-5, "IV is extremely elevated");
    hasElevatedRiskWarning = true;
  } else if (totalReturnPct <= 15) {
    // neutral
  } else if (totalReturnPct <= 30) {
    addFactor(5, "Return potential is decent");
  } else if (totalReturnPct <= 50) {
    addFactor(10, "Return potential is strong");
  } else {
    addFactor(15, "Return potential is exceptional");
  }

  const clampedScore = Math.max(0, Math.min(100, score));
  const notes = factorNotes
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 2)
    .map((factor) => factor.note);
  const label =
    clampedScore >= 80
      ? "Strong"
      : clampedScore >= 65
        ? "Reasonable"
        : clampedScore >= 50
          ? "Borderline"
          : "Weak";

  return {
    score: clampedScore,
    label,
    notes,
    hasElevatedRiskWarning,
  };
};

const STORAGE_KEY = "optionsplanner.coveredCall.inputs.v1";
const STORAGE_DEBOUNCE_MS = 350;

const computeAnnualizedReturn = ({
  totalReturn,
  days,
}: {
  totalReturn: number;
  days: number;
}) => (days > 0 ? totalReturn * (365 / days) : 0);

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);

const getDefaultFormState = () => {
  const defaultExpiration = new Date();
  defaultExpiration.setDate(defaultExpiration.getDate() + 30);

  return {
    symbol: "AAPL",
    stockPrice: "95",
    strikePrice: "105",
    premium: "2.75",
    dividendPerShare: "0.25",
    dividendsExpected: "1",
    shares: "100",
    impliedVolatility: "30",
    expirationDate: formatDateInput(defaultExpiration),
  };
};

type FormState = ReturnType<typeof getDefaultFormState>;

const getResetFormState = () => ({
  symbol: "",
  stockPrice: "0",
  strikePrice: "0",
  premium: "0",
  dividendPerShare: "0",
  dividendsExpected: "0",
  shares: "0",
  impliedVolatility: "30",
  expirationDate: formatDateInput(new Date()),
});

const calculateDaysUntilExpiration = (expirationDate: string) => {
  const expiration = new Date(`${expirationDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (Number.isNaN(expiration.getTime())) {
    return 0;
  }

  const diffMs = expiration.getTime() - today.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
};

export default function CoveredCallPage() {
  const defaultFormStateRef = useRef<FormState>(getDefaultFormState());
  const [formState, setFormState] = useState<FormState>(
    () => defaultFormStateRef.current,
  );
  const hasHydrated = useRef(false);
  const skipNextSave = useRef(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const calculations = useMemo(() => {
    const {
      stockPrice,
      strikePrice,
      premium,
      dividendPerShare,
      dividendsExpected,
      shares,
      impliedVolatility,
      expirationDate,
    } = formState;
    const parsedStockPrice = Number.parseFloat(stockPrice);
    const parsedStrikePrice = Number.parseFloat(strikePrice);
    const parsedPremium = Number.parseFloat(premium);
    const parsedDividendPerShare = Number.parseFloat(dividendPerShare);
    const parsedDividendsExpected = Number.parseInt(dividendsExpected, 10);
    const parsedShares = Number.parseInt(shares, 10);
    const parsedImpliedVolatility = Number.parseFloat(impliedVolatility);
    const safeStockPrice = Number.isFinite(parsedStockPrice)
      ? parsedStockPrice
      : 0;
    const safeStrikePrice = Number.isFinite(parsedStrikePrice)
      ? parsedStrikePrice
      : 0;
    const safePremium = Number.isFinite(parsedPremium) ? parsedPremium : 0;
    const safeDividendPerShare = Number.isFinite(parsedDividendPerShare)
      ? parsedDividendPerShare
      : 0;
    const safeDividendsExpected = Number.isFinite(parsedDividendsExpected)
      ? parsedDividendsExpected
      : 0;
    const safeShares = Number.isFinite(parsedShares) ? parsedShares : 0;
    const safeImpliedVolatility = Number.isFinite(parsedImpliedVolatility)
      ? Math.min(100, Math.max(5, parsedImpliedVolatility))
      : 30;
    const daysUntilExpiration = calculateDaysUntilExpiration(expirationDate);
    const dividendPerShareTotal = safeDividendPerShare * safeDividendsExpected;
    const grossCost = safeStockPrice * safeShares;
    const premiumTotal = safePremium * safeShares;
    const dividendsTotal = dividendPerShareTotal * safeShares;
    const netCost = grossCost - premiumTotal;
    const netCostPerShare = safeStockPrice - safePremium;
    const maxProfitPerShare =
      safeStrikePrice - safeStockPrice + safePremium + dividendPerShareTotal;
    const maxProfitTotal = maxProfitPerShare * safeShares;
    const breakevenPrice =
      safeStockPrice - safePremium - dividendPerShareTotal;
    const upsideCapValue = safeStrikePrice - safeStockPrice;
    const totalReturn =
      safeStockPrice > 0 ? maxProfitPerShare / safeStockPrice : 0;
    const premiumPct =
      safeStockPrice > 0 ? (safePremium / safeStockPrice) * 100 : 0;
    const premiumPerDayPct =
      daysUntilExpiration > 0 ? premiumPct / daysUntilExpiration : 0;
    const upsideCapPct =
      safeStockPrice > 0
        ? ((safeStrikePrice - safeStockPrice) / safeStockPrice) * 100
        : 0;
    const downsideToBreakEvenPct =
      safeStockPrice > 0 && Number.isFinite(breakevenPrice)
        ? Math.max(
            0,
            ((safeStockPrice - breakevenPrice) / safeStockPrice) * 100,
          )
        : 0;
    const annualizedReturn = computeAnnualizedReturn({
      totalReturn,
      days: daysUntilExpiration,
    });
    const tradeQuality = evaluateTradeQuality({
      premiumPerDayPct,
      downsideToBreakEvenPct,
      upsideCapPct,
      totalReturnPct: totalReturn * 100,
      impliedVolatilityPct: safeImpliedVolatility,
    });
    const tradeQualitySubtitle = [
      tradeQuality.notes[0],
      tradeQuality.notes[1],
      tradeQuality.hasElevatedRiskWarning
        ? "elevated vol/event risk possible"
        : null,
    ]
      .filter(Boolean)
      .join("; ");

    return {
      safeStockPrice,
      safeStrikePrice,
      safePremium,
      safeShares,
      safeImpliedVolatility,
      safeDividendsExpected,
      daysUntilExpiration,
      dividendPerShareTotal,
      grossCost,
      netCost,
      netCostPerShare,
      premiumTotal,
      dividendsTotal,
      maxProfitPerShare,
      maxProfitTotal,
      breakevenPrice,
      premiumPct,
      premiumPerDayPct,
      downsideToBreakEvenPct,
      upsideCapValue,
      upsideCapPct,
      totalReturn,
      annualizedReturn,
      tradeQuality,
      tradeQualitySubtitle,
    };
  }, [formState]);

  const handleChange = (field: keyof typeof formState) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setFormState((prev) => ({
        ...prev,
        [field]: event.target.value,
      }));
    };

  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormState((prev) => ({
      ...prev,
      expirationDate: event.target.value,
    }));
  };

  const handleReset = () => {
    const nextState = getResetFormState();
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    }
    skipNextSave.current = true;
    setFormState(nextState);
  };

  useEffect(() => {
    const defaults = defaultFormStateRef.current;
    if (typeof window === "undefined") {
      return;
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      hasHydrated.current = true;
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      const nextState: FormState = { ...defaults };
      const numberFields: Array<keyof Omit<FormState, "expirationDate">> = [
        "stockPrice",
        "strikePrice",
        "premium",
        "dividendPerShare",
        "dividendsExpected",
        "shares",
        "impliedVolatility",
      ];

      if (typeof parsed?.symbol === "string") {
        nextState.symbol = parsed.symbol.toUpperCase().slice(0, 10);
      }

      numberFields.forEach((field) => {
        const value = parsed?.[field];
        if (typeof value === "string") {
          nextState[field] = value;
        } else if (typeof value === "number" && Number.isFinite(value)) {
          nextState[field] = String(value);
        }
      });

      if (
        typeof parsed?.expirationDate === "string" &&
        !Number.isNaN(
          new Date(`${parsed.expirationDate}T00:00:00`).getTime(),
        )
      ) {
        nextState.expirationDate = parsed.expirationDate;
      }

      setFormState(nextState);
    } catch {
      setFormState(defaults);
    } finally {
      hasHydrated.current = true;
    }
  }, []);

  useEffect(() => {
    if (!hasHydrated.current) {
      return;
    }

    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }

    saveTimeout.current = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(formState));
    }, STORAGE_DEBOUNCE_MS);

    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
      }
    };
  }, [formState]);


  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Options Planner</p>
          <h1>Covered Call Planner</h1>
          <p className="lede">
            Estimate income, breakeven, and downside buffer for a covered call trade.
          </p>
        </div>
        <div className="hero-card">
          <h2>Strategy snapshot</h2>
          <ul>
            <li>Sell 1 call against 100 shares you own.</li>
            <li>Collect premium today.</li>
            <li>Cap upside at the strike price.</li>
          </ul>
        </div>
      </section>

      <section className="planner">
        <form className="planner-form">
          <div className="field">
            <label htmlFor="symbol">Stock symbol</label>
            <input
              id="symbol"
              name="symbol"
              type="text"
              value={formState.symbol}
              onChange={handleChange("symbol")}
              maxLength={10}
              placeholder="e.g. AAPL"
              autoCapitalize="characters"
            />
          </div>
          <div className="field">
            <label htmlFor="stockPrice">Current stock price</label>
            <div className="input-wrap">
              <span>$</span>
              <input
                id="stockPrice"
                name="stockPrice"
                type="number"
                step="0.01"
                value={formState.stockPrice}
                onChange={handleChange("stockPrice")}
                required
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="impliedVolatility">Implied volatility</label>
            <input
              id="impliedVolatility"
              name="impliedVolatility"
              type="range"
              min="5"
              max="100"
              step="1"
              value={formState.impliedVolatility}
              onChange={handleChange("impliedVolatility")}
            />
            <p className="helper-text">{calculations.safeImpliedVolatility.toFixed(0)}%</p>
          </div>
          <div className="field">
            <label htmlFor="strikePrice">Call strike price</label>
            <div className="input-wrap">
              <span>$</span>
              <input
                id="strikePrice"
                name="strikePrice"
                type="number"
                step="0.01"
                value={formState.strikePrice}
                onChange={handleChange("strikePrice")}
                required
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="premium">Premium received (per share)</label>
            <div className="input-wrap">
              <span>$</span>
              <input
                id="premium"
                name="premium"
                type="number"
                step="0.01"
                value={formState.premium}
                onChange={handleChange("premium")}
                required
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="dividendPerShare">Dividend per share</label>
            <div className="input-wrap">
              <span>$</span>
              <input
                id="dividendPerShare"
                name="dividendPerShare"
                type="number"
                step="0.01"
                value={formState.dividendPerShare}
                onChange={handleChange("dividendPerShare")}
                required
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="dividendsExpected">Dividends expected</label>
            <input
              id="dividendsExpected"
              name="dividendsExpected"
              type="number"
              step="1"
              min="0"
              value={formState.dividendsExpected}
              onChange={handleChange("dividendsExpected")}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="shares">Shares owned</label>
            <input
              id="shares"
              name="shares"
              type="number"
              step="100"
              value={formState.shares}
              onChange={handleChange("shares")}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="expirationDate">Expiration date</label>
            <input
              id="expirationDate"
              name="expirationDate"
              type="date"
              value={formState.expirationDate}
              onChange={handleDateChange}
              required
            />
            <p className="helper-text">
              {calculations.daysUntilExpiration} days until expiration
            </p>
          </div>
          <div className="field">
            <label htmlFor="impliedVolatility">Implied volatility</label>
            <input
              id="impliedVolatility"
              name="impliedVolatility"
              type="range"
              min="5"
              max="100"
              step="1"
              value={formState.impliedVolatility}
              onChange={handleChange("impliedVolatility")}
            />
            <p className="helper-text">{calculations.safeImpliedVolatility.toFixed(0)}%</p>
          </div>
        </form>
        <button className="text-button" type="button" onClick={handleReset}>
          Reset
        </button>

        <div className="results" aria-live="polite">
          <article className="result-card result-card--profit">
            <h3>Max profit</h3>
            <p>{formatCurrency(calculations.maxProfitTotal)}</p>
            <span>{formatCurrency(calculations.maxProfitPerShare)} per share</span>
          </article>
          <article className="result-card result-card--neutral">
            <h3>Break even</h3>
            <p>{formatCurrency(calculations.breakevenPrice)}</p>
            <span>
              downside to break even: {formatPercentValue(calculations.downsideToBreakEvenPct)}
            </span>
          </article>
          <article className="result-card result-card--cost">
            <h3>Gross position cost</h3>
            <p>{formatCurrency(calculations.grossCost)}</p>
            <span>{formatCurrency(calculations.safeStockPrice)} per share</span>
          </article>
          <article className="result-card result-card--cost">
            <h3>Net position cost</h3>
            <p>{formatCurrency(calculations.netCost)}</p>
            <span>{formatCurrency(calculations.netCostPerShare)} per share</span>
          </article>
          <article className="result-card result-card--cap">
            <h3>Upside cap</h3>
            <p>{formatCurrency(calculations.safeStrikePrice)}</p>
            <span>{formatCurrency(calculations.upsideCapValue)} above spot</span>
          </article>
          <article className="result-card result-card--return">
            <h3>Total return</h3>
            <p>{formatPercent(calculations.totalReturn)}</p>
            <span>{formatPercent(calculations.annualizedReturn)} annualized</span>
          </article>
          <article className="result-card result-card--income">
            <h3>Total income</h3>
            <p>{formatCurrency(calculations.premiumTotal + calculations.dividendsTotal)}</p>
            <span>{formatCurrency(calculations.dividendsTotal)} dividends expected</span>
          </article>
          <article className={`result-card result-card--quality-${calculations.tradeQuality.label.toLowerCase()}`}>
            <h3>Trade quality</h3>
            <p>{calculations.tradeQuality.label}</p>
            <span>
              {calculations.tradeQuality.score}/100 · {calculations.tradeQualitySubtitle || "Balanced risk/reward mix"}
            </span>
          </article>
        </div>
      </section>

      <section className="notes">
        <h2>What this means</h2>
        <div className="note-grid">
          <div>
            <h3>Income today</h3>
            <p>
              Premium reduces your cost basis immediately and provides a buffer against
              a small pullback.
            </p>
          </div>
          <div>
            <h3>Limited upside</h3>
            <p>
              If the stock rallies above the strike, gains are capped at the strike plus
              the premium received.
            </p>
          </div>
          <div>
            <h3>Downside risk remains</h3>
            <p>
              You still own the shares, so declines below the breakeven price are fully
              exposed.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
