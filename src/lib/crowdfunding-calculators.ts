export function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function estimateFundingGoal({
  production,
  fulfillment,
  marketing,
  other,
  contingencyPercent,
  feePercent,
}: {
  production: number;
  fulfillment: number;
  marketing: number;
  other: number;
  contingencyPercent: number;
  feePercent: number;
}) {
  const subtotal = production + fulfillment + marketing + other;
  const contingency = subtotal * (contingencyPercent / 100);
  const beforeFees = subtotal + contingency;
  const safeRate = Math.min(Math.max(feePercent, 0), 95) / 100;
  const goal = beforeFees / (1 - safeRate);
  return { subtotal, contingency, estimatedFees: goal - beforeFees, goal };
}

export function estimateProceeds({
  raised,
  averageBacking,
  platformPercent,
  processingPercent,
  processingFixed,
}: {
  raised: number;
  averageBacking: number;
  platformPercent: number;
  processingPercent: number;
  processingFixed: number;
}) {
  const payments = raised > 0 && averageBacking > 0 ? Math.ceil(raised / averageBacking) : 0;
  const platformFee = raised * (platformPercent / 100);
  const processingFee = raised * (processingPercent / 100) + payments * processingFixed;
  return {
    payments,
    platformFee,
    processingFee,
    proceeds: Math.max(0, raised - platformFee - processingFee),
  };
}

export function estimateRewardPrice({
  unitCost,
  packaging,
  creatorShipping,
  marginPercent,
  platformPercent,
  processingPercent,
  processingFixed,
}: {
  unitCost: number;
  packaging: number;
  creatorShipping: number;
  marginPercent: number;
  platformPercent: number;
  processingPercent: number;
  processingFixed: number;
}) {
  const cost = unitCost + packaging + creatorShipping;
  const targetAfterFees = cost * (1 + marginPercent / 100);
  const variableRate = Math.min(Math.max(platformPercent + processingPercent, 0), 95) / 100;
  const suggestedPrice = (targetAfterFees + processingFixed) / (1 - variableRate);
  return {
    cost,
    targetMargin: targetAfterFees - cost,
    suggestedPrice,
    roundedPrice: Math.ceil(suggestedPrice),
  };
}
