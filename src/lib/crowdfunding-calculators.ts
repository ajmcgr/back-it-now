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

export function estimateBackerTarget({
  goal,
  averageBacking,
  campaignDays,
}: {
  goal: number;
  averageBacking: number;
  campaignDays: number;
}) {
  const backers = goal > 0 && averageBacking > 0 ? Math.ceil(goal / averageBacking) : 0;
  const days = Math.max(1, Math.round(campaignDays));
  return {
    backers,
    backersPerDay: Math.ceil(backers / days),
    backersPerWeek: Math.ceil((backers / days) * 7),
    amountPerDay: goal / days,
  };
}

export function estimateAudienceSize({
  goal,
  averageBacking,
  conversionPercent,
  prelaunchSharePercent,
}: {
  goal: number;
  averageBacking: number;
  conversionPercent: number;
  prelaunchSharePercent: number;
}) {
  const backers = goal > 0 && averageBacking > 0 ? Math.ceil(goal / averageBacking) : 0;
  const conversionRate = Math.min(Math.max(conversionPercent, 0.1), 100) / 100;
  const visitors = Math.ceil(backers / conversionRate);
  const prelaunchBackers = Math.ceil(backers * (Math.min(prelaunchSharePercent, 100) / 100));
  const prelaunchAudience = Math.ceil(prelaunchBackers / conversionRate);
  return { backers, visitors, prelaunchBackers, prelaunchAudience };
}

export function estimateShippingBudget({
  domesticRewards,
  domesticShipping,
  internationalRewards,
  internationalShipping,
  packagingPerReward,
  bufferPercent,
}: {
  domesticRewards: number;
  domesticShipping: number;
  internationalRewards: number;
  internationalShipping: number;
  packagingPerReward: number;
  bufferPercent: number;
}) {
  const shipping =
    domesticRewards * domesticShipping + internationalRewards * internationalShipping;
  const packaging = (domesticRewards + internationalRewards) * packagingPerReward;
  const subtotal = shipping + packaging;
  const buffer = subtotal * (bufferPercent / 100);
  return {
    rewards: domesticRewards + internationalRewards,
    shipping,
    packaging,
    buffer,
    total: subtotal + buffer,
  };
}

export function estimateCampaignProfit({
  raised,
  production,
  fulfillment,
  shipping,
  marketing,
  other,
  platformPercent,
  processingPercent,
}: {
  raised: number;
  production: number;
  fulfillment: number;
  shipping: number;
  marketing: number;
  other: number;
  platformPercent: number;
  processingPercent: number;
}) {
  const campaignFees = raised * ((platformPercent + processingPercent) / 100);
  const projectCosts = production + fulfillment + shipping + marketing + other;
  const remainder = raised - campaignFees - projectCosts;
  return {
    campaignFees,
    projectCosts,
    remainder,
    marginPercent: raised > 0 ? (remainder / raised) * 100 : 0,
  };
}
