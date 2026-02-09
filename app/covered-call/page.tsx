"use client";

import confetti from "canvas-confetti";
import { useEffect, useMemo, useRef, useState } from "react";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);

const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;
const formatPercentValue = (value: number) => `${value.toFixed(2)}%`;

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
    stockPrice: "95",
    strikePrice: "105",
    premium: "2.75",
    dividendPerShare: "0.25",
    dividendsExpected: "1",
    shares: "100",
    expirationDate: formatDateInput(defaultExpiration),
  };
};

type FormState = ReturnType<typeof getDefaultFormState>;

const getResetFormState = () => ({
  stockPrice: "0",
  strikePrice: "0",
  premium: "0",
  dividendPerShare: "0",
  dividendsExpected: "0",
  shares: "0",
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
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const lastPlanSnapshot = useRef<string | null>(null);
  const [resultsInView, setResultsInView] = useState(false);
  const [hasTriggeredConfetti, setHasTriggeredConfetti] = useState(false);
  const [hasUpdatedPlan, setHasUpdatedPlan] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const calculations = useMemo(() => {
    const {
      stockPrice,
      strikePrice,
      premium,
      dividendPerShare,
      dividendsExpected,
      shares,
      expirationDate,
    } = formState;
    const parsedStockPrice = Number.parseFloat(stockPrice);
    const parsedStrikePrice = Number.parseFloat(strikePrice);
    const parsedPremium = Number.parseFloat(premium);
    const parsedDividendPerShare = Number.parseFloat(dividendPerShare);
    const parsedDividendsExpected = Number.parseInt(dividendsExpected, 10);
    const parsedShares = Number.parseInt(shares, 10);
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

    return {
      safeStockPrice,
      safeStrikePrice,
      safePremium,
      safeShares,
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
      downsideToBreakEvenPct,
      upsideCapValue,
      totalReturn,
      annualizedReturn,
    };
  }, [formState]);

  const isDefaultPlan = useMemo(() => {
    const defaults = defaultFormStateRef.current;
    return (Object.keys(defaults) as Array<keyof FormState>).every(
      (key) => defaults[key] === formState[key],
    );
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
      ];

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

  useEffect(() => {
    const currentSnapshot = JSON.stringify(formState);
    if (lastPlanSnapshot.current === null) {
      lastPlanSnapshot.current = currentSnapshot;
      return;
    }

    if (currentSnapshot !== lastPlanSnapshot.current) {
      lastPlanSnapshot.current = currentSnapshot;
      setHasTriggeredConfetti(false);
      setHasUpdatedPlan(true);
    }
  }, [formState]);

  useEffect(() => {
    const resultsNode = resultsRef.current;
    if (!resultsNode || typeof window === "undefined") {
      return;
    }

    if (!("IntersectionObserver" in window)) {
      setResultsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setResultsInView(
          entry.isIntersecting && entry.intersectionRatio >= 0.5,
        );
      },
      { threshold: 0.5 },
    );

    observer.observe(resultsNode);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const formNode = formRef.current;
    if (!formNode) {
      return;
    }

    const handleFocusIn = (event: FocusEvent) => {
      if (event.target instanceof HTMLInputElement) {
        setIsInputFocused(true);
      }
    };

    const handleFocusOut = (event: FocusEvent) => {
      if (event.target instanceof HTMLInputElement) {
        const nextTarget = event.relatedTarget as HTMLElement | null;
        if (nextTarget instanceof HTMLInputElement && formNode.contains(nextTarget)) {
          return;
        }
        setIsInputFocused(false);
      }
    };

    formNode.addEventListener("focusin", handleFocusIn);
    formNode.addEventListener("focusout", handleFocusOut);

    return () => {
      formNode.removeEventListener("focusin", handleFocusIn);
      formNode.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

  useEffect(() => {
    if (!resultsInView) {
      return;
    }

    if (hasTriggeredConfetti || isInputFocused) {
      return;
    }

    const currentReturn = calculations.annualizedReturn;
    if (!Number.isFinite(currentReturn) || currentReturn <= 0.15) {
      return;
    }

    if (!hasUpdatedPlan && isDefaultPlan) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      return;
    }

    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 },
    });
    setHasTriggeredConfetti(true);
  }, [
    calculations.annualizedReturn,
    hasTriggeredConfetti,
    hasUpdatedPlan,
    isDefaultPlan,
    isInputFocused,
    resultsInView,
  ]);

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
        <form className="planner-form" ref={formRef}>
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
        </form>
        <button className="text-button" type="button" onClick={handleReset}>
          Reset
        </button>

        <div className="results" aria-live="polite" ref={resultsRef}>
          <article className="result-card">
            <h3>Max profit</h3>
            <p>{formatCurrency(calculations.maxProfitTotal)}</p>
            <span>
              {formatCurrency(calculations.maxProfitPerShare)} per share
            </span>
          </article>
          <article className="result-card">
            <h3>Break even</h3>
            <p>{formatCurrency(calculations.breakevenPrice)}</p>
            <span>
              downside to break even:{" "}
              {formatPercentValue(calculations.downsideToBreakEvenPct)}
            </span>
          </article>
          <article className="result-card">
            <h3>Gross position cost</h3>
            <p>{formatCurrency(calculations.grossCost)}</p>
            <span>
              {formatCurrency(calculations.safeStockPrice)} per share
            </span>
          </article>
          <article className="result-card">
            <h3>Net position cost</h3>
            <p>{formatCurrency(calculations.netCost)}</p>
            <span>
              {formatCurrency(calculations.netCostPerShare)} per share
            </span>
          </article>
          <article className="result-card">
            <h3>Upside cap</h3>
            <p>{formatCurrency(calculations.safeStrikePrice)}</p>
            <span>{formatCurrency(calculations.upsideCapValue)} above spot</span>
          </article>
          <article className="result-card">
            <h3>Total return</h3>
            <p>{formatPercent(calculations.totalReturn)}</p>
            <span>
              {formatPercent(calculations.annualizedReturn)} annualized
            </span>
          </article>
          <article className="result-card">
            <h3>Total income</h3>
            <p>
              {formatCurrency(
                calculations.premiumTotal + calculations.dividendsTotal,
              )}
            </p>
            <span>
              {formatCurrency(calculations.dividendsTotal)} dividends expected
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
