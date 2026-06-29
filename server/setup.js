import fs from 'fs'

const dirs = [
  './data',
  './src',
]

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
})

console.log('目录结构初始化完成')
