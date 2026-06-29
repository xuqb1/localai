export function errorHandler(err, req, res, next) {
  console.error(err)
  
  if (err.code === 'ERR_INVALID_INPUT') {
    return res.status(400).json({ error: err })
  }
  
  if (err.code === 'ERR_NOT_FOUND') {
    return res.status(404).json({ error: err })
  }
  
  res.status(500).json({
    error: {
      code: 'ERR_INTERNAL',
      message: '服务器内部错误',
    },
  })
}
