import {renderToString} from 'react-dom/server.js'
import home from './home.js'

export default ({style, menu}) => {
  const html = renderToString(home(menu))

  return `
        <html lang="en">
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
                <meta name="theme-color" content="#000000">
                <link rel="shortcut icon" href="/favicon.ico">
                <link type="text/css" rel="stylesheet" href="//use.fontawesome.com/releases/v5.15.3/css/all.css" />
                <link type="text/css" rel="stylesheet" href="/normalize.css" />
                
                <title>We Vacuumlabs</title>
                <style>${style}</style>
            </head>
            <body>
                ${html}
            </body>
        </html>
    `
}
