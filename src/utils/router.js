function matchRoute(routes, method, url) {
  const [pathname, query] = url.split('?')
  for (const r of routes) {
    if (r.method !== method) continue
    const rParts = r.pathname.split('/')
    const uParts = pathname.split('/')
    if (rParts.length !== uParts.length) continue
    const params = {}
    let match = true
    for (let i = 0; i < rParts.length; i++) {
      if (rParts[i].startsWith(':')) {
        params[rParts[i].slice(1)] = uParts[i]
      } else if (rParts[i] !== uParts[i]) {
        match = false; break
      }
    }
    if (match) return { handler: r.handler, params }
  }
  return null
}
module.exports = { matchRoute }
