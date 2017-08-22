const fs = require('fs')
const mdIt = require('markdown-it')
// const markdownItMermaid = require('markdown-it-mermaid')

const md = mdIt({
  html: true,
  linkify: true,
  typographer: true
})

let currentArticleMetaData

md.core.ruler.push('header-extract', function (state, silent) {
  let heading = false
  let introFound = false

  state.md.image = undefined
  state.md.title = undefined
  state.md.intro = undefined

  for (var i = 0, l = state.tokens.length; i < l; i++) {
    var token = state.tokens[i]
    // console.log('token',token)

    if (token.level === 1 && token.type === 'inline' && heading) {
      // console.log('title', token.content)
      state.md.title = token.content
      if (state.md.options.stripTitles) {
        token.content = ''
        token.children[0].content = ''
      }
    }

    if (token.type === 'inline' && token.content !== '@[TOC]' && !heading && introFound === false && token.children[0].type !== 'image' && token.level < 2) {
      /* token.children.forEach(function( child){
        child.type === 'toc_body' && child.type === 'toc_open' && child.type === 'toc_close'
      }) */
      // console.log('intro:', token, introFound)
      // console.log('intro:', token.content, introFound)
      introFound = true
      state.md.intro = token.content
    }

    if (token.type === 'heading_open' && token.tag === 'h1') {
      // console.log('heading_open', token)
      heading = true
    }
    if (token.type === 'heading_close' && heading) {
      // console.log('heading_open', token)
      heading = false
    }
    if (token.type === 'inline' && token.children && token.children[0] && token.children[0].type === 'image') {
      const image = token.children[0].attrs[0][1]
      // console.log('image', image)// .attrs.src)
      state.md.image = image
    }
  }
  return false
})

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
//
const path = require('path')

const yaml = require('js-yaml')
const config = yaml.safeLoad(fs.readFileSync('./config.yml'))

const {author, keywords, siteUrl, siteTitle, siteDescription, articleFooterFields, siteEntries} = config

const sourceDir = './source'
const articlesDir = path.join(sourceDir, 'articles')
const imagesDir = path.join(sourceDir, 'images')
const outputDir = path.resolve('.', 'output')

function generateFooter (metadata) {
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

  return `<footer>
    <ul>
      ${footerFields}
    </ul>
  </footer>`
}

function generateArticleExcerpt (mdNoTitle, metadata, footer) {
  const content = require('remove-markdown')(
  require('front-matter')(mdNoTitle).body
    .replace(/#/g, '')
    .replace(/@\[TOC]/g, ''))

  const {title, intro, siteUrl, articleUrl, featuredImg} = metadata

  const featuredImage = featuredImg ? `
    <figure class='post-featured-image'>
      <a href='${articleUrl}' title='${title}'>
        <img width='221' height='350' src='${featuredImg}' alt='${title}' title='${title}' srcset='${featuredImg} 506w, ${featuredImg} 189w' sizes='(max-width: 221px) 100vw, 221px' />
      </a>
    </figure>
  ` : ''
  return `
    <article id='post-' class='post post-excerpt'>
      <header class='entry-header'>
        <h1 class='entry-title'>
          <a href='${articleUrl}' title='${title}'>${title}</a>
        </h1>
      </header>

      ${featuredImage}

      <div class='entry-content clearfix'>
        <p>${intro.substring(0, 150)}...</p>
      </div>
      ${footer}
    </article>
  `
}

function generateArticle (siteTop, markup, metadata, footer) {
  return `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${siteTitle} | ${siteDescription}</title>
        <meta name="description" content="${siteDescription}">
        <meta name="keywords" content="${keywords}">
        <meta name="author" content="${author}">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">

        <link rel="stylesheet" href="index.css">
        <link rel="stylesheet" href="node_modules/prismjs/themes/prism.css">
      </head>
      <body>
        <div class='container'>
          ${siteTop}
          <article class="post markdown-body content">
            ${markup}
            ${footer}
          </article>
        </div>
      </body>
    </html>`
}

function generatePagesFromArticles (siteTop) {
  const dirContents = fs.readdirSync(articlesDir)// .filter(x => x.endsWith('.md'))
    .map(f => path.resolve(articlesDir, f))
    .map(function (fullPath) {
      const stats = fs.statSync(fullPath)
      const isArticle = !stats.isDirectory() && fullPath.endsWith('.md')

      if (isArticle) {
        const rawMd = fs.readFileSync(fullPath, 'utf8')

        md.options.stripTitles = true
        const mdNoTitle = md.render(rawMd)
        md.options.stripTitles = false
        const mdFull = md.render(rawMd)
        // console.log('after render', md.title)

        const metaDefaults = {
          title: '',
          intro: '',
          author: '',
          mainTag: undefined,
          comments: [],
          link: '',
          siteUrl,
          filePath: path.basename(fullPath, '.md'),
          articleUrl: './' + path.basename(fullPath, '.md') + '.html'// siteUrl + '/articles/' + path.basename(fullPath, '.md') + '.html'
        }
        const metadata = Object.assign({}, metaDefaults, currentArticleMetaData, {tile: md.title, featuredImg: md.image, intro: md.intro})

        const footer = generateFooter(metadata)
        const excerpt = generateArticleExcerpt(mdNoTitle, metadata, footer)
        const article = generateArticle(siteTop, mdFull, metadata, footer)
        fs.writeFileSync(path.join(outputDir, path.basename(fullPath, '.md') + '.html'), article)

        return excerpt
      }
    })
    .reduce((acc, cur) => acc + cur)// for comma removal
  return dirContents
}

// generatePagesFromArticles()

function buildSite (header = '', body = '') {
  console.log('siteEntries', siteEntries)
  const siteLinks = siteEntries
    .map(x => `<li><a href="${siteUrl}/${x}.html">${x}</a></li>`)
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

  body = generatePagesFromArticles(siteTop)

  return `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${siteTitle} | ${siteDescription}</title>
        <meta name="description" content="${siteDescription}">
        <meta name="keywords" content="${keywords}">
        <meta name="author" content="${author}">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">

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

console.log('generating site')

const html = buildSite('')

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir)
}
const outpath = path.join(outputDir, 'index.html')
fs.writeFileSync(outpath, html)
console.log('generation done')
