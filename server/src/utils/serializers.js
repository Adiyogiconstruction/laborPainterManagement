export function safeUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, active: user.active, createdAt: user.createdAt };
}

export function dateRange(query) {
  const range = {};
  if (query.from) range.$gte = new Date(`${query.from}T00:00:00.000Z`);
  if (query.to) range.$lte = new Date(`${query.to}T23:59:59.999Z`);
  return Object.keys(range).length ? range : undefined;
}

export function pick(object, keys) {
  return keys.reduce((result, key) => {
    if (object[key] !== undefined) result[key] = object[key];
    return result;
  }, {});
}
