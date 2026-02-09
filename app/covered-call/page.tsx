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

const computeAnnualizedReturn = ({
  totalReturn,
  days,
}: {
  totalReturn: number;
  days: number;
}) => (days > 0 ? totalReturn * (365 / days) : 0);

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);

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
  const defaultExpiration = new Date();
  defaultExpiration.setDate(defaultExpiration.getDate() + 30);

  const [formState, setFormState] = useState({
    stockPrice: 95,
    strikePrice: 105,
    premium: 2.75,
    dividendPerShare: 0.25,
    dividendsExpected: 1,
    shares: 100,
    expirationDate: formatDateInput(defaultExpiration),
  });
  const lastSubmittedAnnualizedReturn = useRef(
    computeAnnualizedReturn({
      totalReturn: 0,
      days: calculateDaysUntilExpiration(formState.expirationDate),
    }),
  );
  const hasMounted = useRef(false);

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
    const daysUntilExpiration = calculateDaysUntilExpiration(expirationDate);
    const dividendPerShareTotal = dividendPerShare * dividendsExpected;
    const grossCost = stockPrice * shares;
    const premiumTotal = premium * shares;
    const dividendsTotal = dividendPerShareTotal * shares;
    const netCost = grossCost - premiumTotal;
    const netCostPerShare = stockPrice - premium;
    const maxProfitPerShare =
      strikePrice - stockPrice + premium + dividendPerShareTotal;
    const maxProfitTotal = maxProfitPerShare * shares;
    const breakevenPrice = stockPrice - premium - dividendPerShareTotal;
    const upsideCapValue = strikePrice - stockPrice;
    const totalReturn = stockPrice > 0 ? maxProfitPerShare / stockPrice : 0;
    const annualizedReturn = computeAnnualizedReturn({
      totalReturn,
      days: daysUntilExpiration,
    });

    return {
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
      upsideCapValue,
      totalReturn,
      annualizedReturn,
    };
  }, [formState]);

  const handleChange = (field: keyof typeof formState) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value =
        event.target.value === "" ? 0 : Number(event.target.value);
      setFormState((prev) => ({
        ...prev,
        [field]: Number.isFinite(value) ? value : 0,
      }));
    };

  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormState((prev) => ({
      ...prev,
      expirationDate: event.target.value,
    }));
  };

  useEffect(() => {
    const currentReturn = calculations.annualizedReturn;

    if (!Number.isFinite(currentReturn)) {
      return;
    }

    const previousReturn = lastSubmittedAnnualizedReturn.current;
    lastSubmittedAnnualizedReturn.current = currentReturn;

    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    if (previousReturn < 0.15 && currentReturn >= 0.15) {
      if (typeof window === "undefined") {
        return;
      }

      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (!prefersReducedMotion) {
        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 },
        });
      }
    }
  }, [calculations.annualizedReturn]);

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

        <div className="results" aria-live="polite">
          <article className="result-card">
            <h3>Max profit</h3>
            <p>{formatCurrency(calculations.maxProfitTotal)}</p>
            <span>
              {formatCurrency(calculations.maxProfitPerShare)} per share
            </span>
          </article>
          <article className="result-card">
            <h3>Break-even downside</h3>
            <p>{formatCurrency(calculations.breakevenPrice)}</p>
            <span>
              {formatCurrency(calculations.dividendPerShareTotal)} dividends +{" "}
              {formatCurrency(formState.premium)} premium per share
            </span>
          </article>
          <article className="result-card">
            <h3>Gross position cost</h3>
            <p>{formatCurrency(calculations.grossCost)}</p>
            <span>
              {formatCurrency(formState.stockPrice)} per share
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
            <p>{formatCurrency(formState.strikePrice)}</p>
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
