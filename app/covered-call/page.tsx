"use client";

import confetti from "canvas-confetti";
import { useMemo, useRef, useState } from "react";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);

const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;

const computeAnnualizedYield = ({
  stockPrice,
  premium,
  days,
}: {
  stockPrice: number;
  premium: number;
  days: number;
}) => (days > 0 ? (premium / stockPrice) * (365 / days) : 0);

export default function CoveredCallPage() {
  const [formState, setFormState] = useState({
    stockPrice: 95,
    strikePrice: 105,
    premium: 2.75,
    shares: 100,
    days: 30,
  });
  const lastSubmittedAnnualizedYield = useRef(
    computeAnnualizedYield(formState),
  );

  const calculations = useMemo(() => {
    const { stockPrice, strikePrice, premium, shares, days } = formState;
    const premiumTotal = premium * shares;
    const maxProfitPerShare = strikePrice - stockPrice + premium;
    const maxProfitTotal = maxProfitPerShare * shares;
    const breakevenPrice = stockPrice - premium;
    const upsideCapValue = strikePrice - stockPrice;
    const annualizedYield = computeAnnualizedYield({
      stockPrice,
      premium,
      days,
    });

    return {
      premiumTotal,
      maxProfitPerShare,
      maxProfitTotal,
      breakevenPrice,
      upsideCapValue,
      annualizedYield,
    };
  }, [formState]);

  const handleChange = (field: keyof typeof formState) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setFormState((prev) => ({
        ...prev,
        [field]: Number(event.target.value),
      }));
    };

  const handleUpdatePlan = () => {
    const previousYield = lastSubmittedAnnualizedYield.current;
    const currentYield = calculations.annualizedYield;
    lastSubmittedAnnualizedYield.current = currentYield;

    if (previousYield < 0.15 && currentYield >= 0.15) {
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
  };

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
            <label htmlFor="days">Days to expiration</label>
            <input
              id="days"
              name="days"
              type="number"
              value={formState.days}
              onChange={handleChange("days")}
              required
            />
          </div>
          <button className="primary" type="button" onClick={handleUpdatePlan}>
            Update plan
          </button>
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
            <h3>Breakeven</h3>
            <p>{formatCurrency(calculations.breakevenPrice)}</p>
            <span>{formatCurrency(formState.premium)} buffer per share</span>
          </article>
          <article className="result-card">
            <h3>Upside cap</h3>
            <p>{formatCurrency(formState.strikePrice)}</p>
            <span>{formatCurrency(calculations.upsideCapValue)} above spot</span>
          </article>
          <article className="result-card">
            <h3>Annualized yield</h3>
            <p>{formatPercent(calculations.annualizedYield)}</p>
            <span>
              {formatCurrency(calculations.premiumTotal)} premium collected
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
