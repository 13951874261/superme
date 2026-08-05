export async function loadExpandedVocab<TList, TReview>(
  loadList: () => Promise<TList>,
  cachedReview: TReview | null,
  loadReview: () => Promise<TReview>,
): Promise<{ list: TList; review: TReview }> {
  const listPromise = loadList();
  const review = cachedReview ?? await loadReview();

  return {
    list: await listPromise,
    review,
  };
}
