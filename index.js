const fs = require('fs')
const mdIt = require('markdown-it')
// const markdownItMermaid = require('markdown-it-mermaid')

const md = mdIt({
  html: true,
  linkify: true,
  typographer: true
})

let currentArticleMetaData

md.use(require('markdown-it-footnote'))
  .use(require('markdown-it-checkbox'), {
    divWrap: true,
    divClass: 'cb',
    idPrefix: 'cbx_'
  })
  .use(require('markdown-it-toc-and-anchor').default, {
    anchorLinkSpace: false,
    anchorLink: false
  })
  .use(require('markdown-it-html5-embed'), {
    html5embed: {
      useImageSyntax: true, // Enables video/audio embed with ![]() syntax (default)
      useLinkSyntax: false   // Enables video/audio embed with []() syntax
    }})
  .use(require('markdown-it-video', {
    youtube: { width: 640, height: 390 },
    vimeo: { width: 500, height: 281 },
    vine: { width: 600, height: 600, embed: 'simple' },
    prezi: { width: 550, height: 400 }
  }))
  .use(require('markdown-it-prism'), { plugins: ['line-numbers', 'show-invisibles'] })
  .use(require('markdown-it-front-matter'), function (fm) { // used for extracting metadata
    const res = require('js-yaml').safeLoad(fm)
    currentArticleMetaData = res
  })
// mdi.use(markdownItMermaid)
const path = require('path')

const yaml = require('js-yaml')
const config = yaml.safeLoad(fs.readFileSync('./config.yml'))

const {siteEntries, siteUrl, siteTitle, siteDescription, articleFooterFields} = config

const sourceDir = './source'
const articlesDir = path.join(sourceDir, 'articles')
const imagesDir = path.join(sourceDir, 'images')

function generateArticleExcerpt (rawMd, parsedMd, metadata) {
  const content = require('remove-markdown')(
  require('front-matter')(rawMd).body
    .replace(/#/g, '')
    .replace(/\@\[TOC]/g, ''))

  const {title, siteUrl, articleUrl, featuredImg} = metadata
  const fieldNames = articleFooterFields

  const icons = fs.readdirSync(imagesDir)
    .filter(x => x.endsWith('.svg'))
    .reduce(function (icons, iconFileName) {
      icons[path.basename(iconFileName, '.svg')] = fs.readFileSync(path.join(imagesDir, iconFileName), 'utf8')
      return icons
    }, {})

  const footerFields = fieldNames
    .filter(f => metadata[f] !== undefined && metadata[f] !== '')
    .map(f => {
      const isComments = f === 'comments'
      const extras = isComments && metadata[f].length === 0 ? 'no comments' : ''
      const icon = icons[f] ? icons[f] : ''
      return `<li>
      <span class='icon'>${icon}</span>
      <a href='${siteUrl}/${f}/${metadata[f]}}'>${metadata[f]} ${extras}</a>
    </li>`
    })
    .reduce((acc, cur) => acc + cur)

  const featuredImage = featuredImg ? `
    <figure class='post-featured-image'>
      <a href='${articleUrl}' title='${title}'>
        <img width='221' height='350' src='${featuredImg}' alt='${title}' title='${title}' srcset='${featuredImg} 506w, ${featuredImg} 189w' sizes='(max-width: 221px) 100vw, 221px' />
      </a>
    </figure>
  ` : ''
  return `
    <article id='post-' class='post-excerpt'>
      <header class='entry-header'>
        <h1 class='entry-title'>
          <a href='${articleUrl}' title='${title}'>${title}</a>
        </h1>
      </header>

      ${featuredImage}

      <div class='entry-content clearfix'>
        <p>${content.substring(0, 150)}...</p>
      </div>
      <footer>
        <ul>
          ${footerFields}
        </ul>
      </footer>
    </article>
  `
}

function generateArticle (content, metadata) {
  return `<div class="markdown-body content">
    ${content}
  </div>`
}

function generatePagesFromArticles () {
  const dirContents = fs.readdirSync(articlesDir)// .filter(x => x.endsWith('.md'))
    .map(f => path.resolve(articlesDir, f))
    .map(function (fullPath) {
      const stats = fs.statSync(fullPath)
      const isArticle = !stats.isDirectory() && fullPath.endsWith('.md')

      if (isArticle) {
        const rawMd = fs.readFileSync(fullPath, 'utf8')
        const parsedMd = md.render(rawMd)

        const metaDefaults = {
          author: '',
          mainTag: undefined,
          comments: [],
          link: '',
          siteUrl,
          filePath: path.basename(fullPath, '.md'),
          articleUrl: siteUrl + '/articles/' + path.basename(fullPath, '.md') + '.html'
        }
        const metadata = Object.assign({}, metaDefaults, currentArticleMetaData)
        return generateArticleExcerpt(rawMd, parsedMd, metadata)
      }
    })
    .reduce((acc, cur) => acc + cur)// for comma removal
  return dirContents
}

// generatePagesFromArticles()

function buildHtml (header = '', body = '') {
  body = generatePagesFromArticles()
  const siteLinks = siteEntries
    .map(x => `<li><a href="#">${x}</a></li>`)
    .reduce((acc, cur) => acc + cur)

  const siteTop = `<section class='header'>
    <section id='header-left'>
      <section id='site-title'>
       <h1> <a href="${siteUrl}">${siteTitle}</a> </h1>
      </section>
      <section id='site-description'>
        <h2>${siteDescription}</h2>
      </section>
    </section>
    <nav id='site-nav' role="navigation">
      <ul>
        ${siteLinks}
      </ul>
    </nav>
  </section>`

  return `<!DOCTYPE html>
    <html>
      <head>
        <link rel="stylesheet" href="index.css">
        <link rel="stylesheet" href="node_modules/prismjs/themes/prism.css">
      </head>
      <body>
        <div class='container'>
          ${siteTop}
          <div class="content">
            ${body}
          </div>
        </div>
      </body>
    </html>`
}

const html = buildHtml('')
const outpath = 'index.html'
fs.writeFileSync(outpath, html)
