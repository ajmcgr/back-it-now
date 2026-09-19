// Retired with the removal of all-or-nothing funding. This endpoint deliberately
// performs no financial action, including no goal-failure refunds or transfers.
Deno.serve(() => Response.json({ retired: true }, { status: 410 }));
