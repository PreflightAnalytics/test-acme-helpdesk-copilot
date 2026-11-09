const EURO = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });

export const euros = (amount) => EURO.format(Number(amount));
