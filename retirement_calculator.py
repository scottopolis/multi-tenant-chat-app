#!/usr/bin/env python3
"""
Retirement Projection Calculator
"""

def retirement_projection(
    current_age: int,
    current_savings: float,
    retirement_age: int,
    years_in_retirement: int,
    annual_growth_rate: float,
):
    r = annual_growth_rate

    # --- Phase 1: Accumulation ---
    accumulation_years = retirement_age - current_age
    nest_egg = current_savings * (1 + r) ** accumulation_years

    # --- Phase 2: Distribution ---
    # Annual payment from an ordinary annuity:
    # PMT = PV * r / (1 - (1 + r)^-n)
    n = years_in_retirement
    annuity_factor = (1 - (1 + r) ** -n) / r
    annual_withdrawal = nest_egg / annuity_factor
    monthly_withdrawal = annual_withdrawal / 12

    # Year-by-year balance during retirement
    schedule = []
    balance = nest_egg
    for year in range(1, n + 1):
        interest = balance * r
        balance = balance + interest - annual_withdrawal
        schedule.append((retirement_age + year - 1, balance + annual_withdrawal, annual_withdrawal, balance))

    return {
        "accumulation_years": accumulation_years,
        "nest_egg_at_retirement": nest_egg,
        "annual_withdrawal": annual_withdrawal,
        "monthly_withdrawal": monthly_withdrawal,
        "schedule": schedule,
    }


def fmt(n: float) -> str:
    return f"${n:>15,.0f}"


if __name__ == "__main__":
    params = dict(
        current_age=44,
        current_savings=2_000_000,
        retirement_age=50,
        years_in_retirement=20,
        annual_growth_rate=0.07,
    )

    res = retirement_projection(**params)

    r = params["annual_growth_rate"]
    retire_age = params["retirement_age"]
    end_age = retire_age + params["years_in_retirement"]

    print("=" * 60)
    print("          RETIREMENT PROJECTION SUMMARY")
    print("=" * 60)
    print(f"  Current age          : {params['current_age']}")
    print(f"  Current savings      : {fmt(params['current_savings'])}")
    print(f"  Retirement age       : {retire_age}")
    print(f"  Years in retirement  : {params['years_in_retirement']}  (ages {retire_age}–{end_age})")
    print(f"  Assumed growth rate  : {r*100:.1f}% / year")
    print()
    print(f"  Growth phase         : {res['accumulation_years']} years")
    print(f"  Portfolio at 50      : {fmt(res['nest_egg_at_retirement'])}")
    print()
    print(f"  Annual withdrawal    : {fmt(res['annual_withdrawal'])}")
    print(f"  Monthly withdrawal   : {fmt(res['monthly_withdrawal'])}")
    print("=" * 60)

    print()
    print("  Year-by-year balance during retirement")
    print(f"  {'Age':>4}  {'Start Balance':>15}  {'Withdrawal':>13}  {'End Balance':>15}")
    print("  " + "-" * 54)
    for age, start_bal, withdrawal, end_bal in res["schedule"]:
        print(f"  {age:>4}  {fmt(start_bal):>15}  {fmt(withdrawal):>13}  {fmt(end_bal):>15}")

    print("=" * 60)
    final_balance = res["schedule"][-1][3]
    if abs(final_balance) < 1:
        print("  Portfolio reaches exactly $0 at end of retirement.")
    else:
        print(f"  Remaining balance at end : {fmt(final_balance)}")
    print("=" * 60)
