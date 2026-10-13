export async function fetchAllPages(fetchPage, pageSize = 500) {
  const firstPage = await fetchPage(0, pageSize);
  if (!Array.isArray(firstPage?.items) || !Number.isSafeInteger(firstPage.total)) {
    throw new Error("The paginated response is invalid.");
  }

  const items = [...firstPage.items];
  for (let batchStart = pageSize; batchStart < firstPage.total; ) {
    const offsets = [];
    const batchEnd = Math.min(batchStart + pageSize * 5, firstPage.total);
    for (let skip = batchStart; skip < batchEnd; skip += pageSize) {
      offsets.push(skip);
    }
    const pages = await Promise.all(
      offsets.map((skip) => fetchPage(skip, pageSize)),
    );
    for (const page of pages) {
      if (!Array.isArray(page?.items)) {
        throw new Error("The paginated response is invalid.");
      }
      items.push(...page.items);
    }
    batchStart = batchEnd;
  }

  const uniqueItems = new Map();
  for (const item of items) {
    if (item?._id) uniqueItems.set(String(item._id), item);
  }
  return [...uniqueItems.values()];
}
