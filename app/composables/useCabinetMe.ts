/**
 * Shared, deduplicated fetch for the cabinet "me" endpoint.
 * Using the same `key` across layout + pages means the HTTP request
 * is made only once and all callers share the same reactive state.
 */
export function useCabinetMe() {
  return useFetch('/api/cabinet/me', {
    key: 'cabinet-me',
    server: false,
    lazy: true,
  })
}

/**
 * Call in a page's setup to redirect to /cabinet/auth on 401.
 * Non-blocking — does NOT await the fetch before rendering.
 */
export function useCabinetAuth() {
  const { error } = useCabinetMe()
  watchEffect(() => {
    if (error.value?.statusCode === 401) navigateTo('/cabinet/auth')
  })
}
