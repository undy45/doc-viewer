import querystring from 'querystring'
import path from 'path'
import express from 'express'
import {expressHelpers, run} from 'yacol'
import cookieParser from 'cookie-parser'
import fetch from 'node-fetch'
import fs from 'mz/fs'
import c from './config'
import {amICollaborator as _amICollaborator, errorUnauthorized} from './ghApi.js'
import memoize from './memoize'
import unzip from 'unzip2'

const app = express()
const {register, runApp} = expressHelpers
const amICollaborator = memoize(_amICollaborator, c.cacheMaxRecords, c.authorizationMaxAge)

app.use(cookieParser())

function sendToLogin(req, res) {
  res.cookie('redirectAfterLogin', req.url, {httpOnly: true, secure: c.isHttps})
  res.redirect('/login')
}

function* checkRights(req, repo) {
  if (repo == null) return true

  const token = req.cookies.access_token
  if (!token) return {error: errorUnauthorized}

  return yield run(amICollaborator, token, c.ghOrganization, repo)
    .catch((e) => {
      if (e.error === errorUnauthorized) return e
      else throw(e)
    })
}

function* login(req, res) {
  const url = 'https://github.com/login/oauth/authorize'
  const query = {
    scope: 'repo',
    client_id: c.ghClient.id,
  }
  res.redirect(`${url}?${querystring.stringify(query)}`)
}

function* oauth(req, res) {
  const url = 'https://github.com/login/oauth/access_token'

  const authParams = {
    client_id: c.ghClient.id,
    client_secret: c.ghClient.secret,
    code: req.query.code,
    accept: 'json'
  }

  const authRes = yield fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(authParams)
  })

  const authJSON = yield authRes.json()
  if (authJSON.access_token) {
    res.cookie('access_token', authJSON.access_token, {httpOnly: true})
    res.redirect(req.cookies.redirectAfterLogin || '/')
  } else {
    res.redirect('/login')
  }
}

const validDocId = (docId) => docId && docId.match(/^[a-zA-Z0-9-]*$/)

function docs(subPath) {
  return function* (req, res) {
    const docId = req.params.docId
    const localPart = path.normalize(req.params[0] || '/')

    const isReqValid = validDocId(docId) && !localPart.startsWith('..')

    if (!isReqValid) {
      res.status(404).send('Not Found')
      return
    }

    const root = path.join(c.docsPath, subPath, docId)

    const configFile = path.join(root, 'docs.json')
    const config = yield run(function*() {
      return JSON.parse(yield fs.readFile(configFile, 'utf-8'))
    }).catch((e) => {
      if (e.code === 'ENOENT') return {}
      else throw e
    })

    const hasRights = yield run(checkRights, req, config.read)

    if (hasRights.error) {
      sendToLogin(req, res)
      return
    } else if (hasRights === true) {
      res.sendFile(path.join(root, localPart))
      return
    } else if (hasRights === false) {
      res.status(401).send('You do not have rights to access these docs.')
    }
  }
}

function assertApiKey(req, res) {
  if (req.get('Authorization') !== c.apiKey) {
    res.status(401).send('Invalid API Key')
    return false
  }
  return true
}

function* upload(req, res) {
  if (!assertApiKey(req, res)) return

  const docId = Math.floor((Date.now() + Math.random())*1000).toString(36)
  req.pipe(unzip.Extract({path: path.join(c.docsPath, c.draftFolder, docId)}))
  req.on('end', () => res.status(200).send(docId))
}

function* link(req, res) {
  if (!assertApiKey(req, res)) return

  const {docId, name} = req.params
  const isReqValid = validDocId(docId) && validDocId(name)
  if (!isReqValid) {
    res.status(400).send('Invalid request.')
    return
  }

  // Path to created link
  const pathToLink = path.join(c.docsPath, c.finalFolder, name)
  yield fs.unlink(pathToLink).catch((e) => {
    if (e.code === 'ENOENT') return
    else throw e
  })

  yield fs.symlink(
    // Relative path as from /final folder
    path.join('..', c.draftFolder, docId),
    pathToLink
  )
  res.status(200).send()
}

function* index(req, res) {
  res.send('Nothing interesting here.')
}

register(app, 'get', '/', index)
register(app, 'get', '/login', login)
register(app, 'get', '/oauth', oauth)
register(app, 'get', '/drafts/:docId/*?', docs(c.draftFolder))
register(app, 'get', '/docs/:docId/*?', docs(c.finalFolder))
register(app, 'post', '/upload', upload)
register(app, 'put', '/link/:docId/:name', link)

run(function* () {
  run(runApp)
  app.listen(c.port, () =>
    console.log(`App started on localhost:${c.port}.`)
  )
})
