declare function currency(value: number | string | currency, opts?: currency.Options): currency;
declare namespace currency {
  interface Options {
    symbol?: string; separator?: string; decimal?: string;
    precision?: number; pattern?: string; negativePattern?: string;
    fromCents?: boolean; increment?: number;
  }
}
declare interface currency {
  value: number;
  intValue: number;
  format(opts?: currency.Options): string;
  add(number: number | string | currency): currency;
  subtract(number: number | string | currency): currency;
  multiply(number: number): currency;
  divide(number: number): currency;
  distribute(count: number): currency[];
}
export default currency;
