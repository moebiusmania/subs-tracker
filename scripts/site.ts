// The site's address: canonical and social preview URLs are absolute, and its
// path is the base every URL is prefixed with ("/subs-tracker/" on GitHub
// Pages, see build:gh in package.json)
export const site = process.env.SITE_URL ?? "http://localhost/";
