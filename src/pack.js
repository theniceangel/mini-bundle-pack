const fs = require('fs')
const babylon = require('babylon')
const traverse = require('babel-traverse').default
const { transformFromAst } = require('babel-core')
const path = require('path')
let aid = 0

// 加载一个模块
const createAsset = (filename) => {
  const id = aid++
  const dependencies = []
  const content = fs.readFileSync(filename, 'utf-8')
  const ast = babylon.parse(content, {
    sourceType: 'module'
  })
  
  traverse(ast, {
    ImportDeclaration ({ node }) {
      dependencies.push(node.source.value)
    } 
  })

  const { code } = transformFromAst(ast, null, {
    presets: ['env']
  })

  return {
    id,
    filename,
    dependencies,
    code
  }
}

// 生成 graph

const createGraph = (entry) => {
  const mainAsset = createAsset(entry)
  const queue = [mainAsset]

  for (const asset of queue) {
    asset.mapping = {}
    const dirname = path.dirname(asset.filename)
    asset.dependencies.forEach((relativePath) => {
      const absolutePath = path.join(dirname, relativePath)

      const child = createAsset(absolutePath)
      asset.mapping[relativePath] = child.id

      queue.push(child)
    })
  }
  console.log(queue)
  return queue
}

const bundle = (graph) => {
  let modules = ''
  graph.forEach((mod) => {
    modules += `${mod.id}: [
      function (module, exports, require) {
        ${mod.code}
      },
      ${JSON.stringify(mod.mapping)}
    ],
    `
  })
  const ret = `(function(modules){
    function require (id) {
      const [fn, mapping] = modules[id];

      function localRequire(name) {
        return require(mapping[name]);
      }

      let module = {
        exports: {},
        loaded: false
      };

      fn(module, module.exports, localRequire);
      
      module.loaded = true;

      return module.exports
    }
  
    require(0)
  })({${modules}});`

  fs.writeFile(path.join(__dirname, '../example/bundle.js'), ret)
}




const graph =createGraph(path.join(__dirname, '../example/entry.js'))
bundle(graph)