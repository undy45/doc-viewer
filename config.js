import e from './env.js'
import path from 'path'

const {bool, env, getErrors} = e()

const toAbsolute = (p) => path.isAbsolute(p) ? p : path.join(__dirname, p)

export default {
  isHttps: bool('HTTPS'),
  apiKey: env('API_KEY'),
  port: env('PORT'),
  authorizationMaxAge: env('AUTHORIZATION_MAX_AGE'),
  cacheMaxRecords: 1000,
  ghClient: {
    id: env('GH_CLIENT_ID'),
    secret: env('GH_CLIENT_SECRET'),
  },
  ghOrganization: env('GH_ORGANIZATION'),
  docsPath: toAbsolute(env('DOCS_PATH')),
  draftFolder: 'draft',
  finalFolder: 'final',
}

getErrors()
