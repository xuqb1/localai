# 🧠 LocalAI - 本地知识库智能问答系统

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT) [![Node.js](https://img.shields.io/badge/Node.js-18.x-339933?logo=node.js)](https://nodejs.org/) [![Vue.js](https://img.shields.io/badge/Vue.js-3.x-4FC08D?logo=vue.js)](https://vuejs.org/) [![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite)](https://vitejs.dev/)

LocalAI 是一个基于本地知识库的智能问答系统，支持多种文档格式导入，结合大语言模型（LLM）为您提供精准的问答服务。所有数据存储在本地，保护您的隐私安全。

## ✨ 核心功能

### 📚 知识库管理
- **多格式文档支持**：支持 TXT、CSV、Markdown、HTML、Word、Excel 等常见文档格式
- **批量导入**：支持批量上传文档，自动解析和向量化
- **智能检索**：基于向量检索技术，快速定位相关知识
- **可视化预览**：支持查看已导入的知识库内容

### 🤖 智能问答
- **混合检索**：结合知识库检索和大模型能力，提供精准回答
- **流式响应**：实时生成回答，提升交互体验
- **多模型支持**：支持 DeepSeek、Agnes 等多种大模型
- **对话历史**：自动保存对话记录，方便回溯

### ⚙️ 系统设置
- **模型配置**：灵活切换不同的大模型
- **参数调节**：可调整温度、最大 Token 等参数
- **API 管理**：支持配置多个模型的 API Key

## 🎯 应用场景

- **企业知识库**：构建企业内部文档问答系统
- **个人知识助手**：管理个人笔记、文档，快速检索信息
- **客服系统**：基于产品文档构建智能客服
- **教育培训**：构建课程资料问答系统

## 🛠️ 技术栈

### 后端
- **Node.js** - JavaScript 运行环境
- **Express** - Web 应用框架
- **hnswlib-node** - 高性能向量索引库
- **better-sqlite3** - 轻量级数据库
- **Axios** - HTTP 客户端

### 前端
- **Vue 3** - 渐进式 JavaScript 框架
- **Vite** - 快速构建工具
- **Pinia** - Vue 状态管理
- **Axios** - HTTP 客户端
- **Tailwind CSS** - 样式框架
- **Lucide Vue** - 图标库

### 向量化与 AI
- **HNSW** - 近似最近邻搜索算法
- **DeepSeek API** - 大语言模型
- **本地向量存储** - 数据本地化，保护隐私

## 📦 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0

### 安装步骤

1. **克隆项目**
```bash
git clone https://github.com/xuqb1/localai.git
cd localai
```

2. **安装后端依赖**
```bash
cd server
npm install
```

3. **安装前端依赖**
```bash
cd ../client
npm install
```

4. **配置环境变量**
创建 server/.env 文件：
```env
# DeepSeek API
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1

# Agnes API (可选)
AGNES_API_KEY=your_agnes_api_key
AGNES_BASE_URL=https://api.agnes.ai/v1

# 服务器配置
PORT=3001
NODE_ENV=development
```

5. **启动服务**
启动后端：
```bash
cd server
npm run dev
```
启动前端：
```bash
cd client
npm run dev
```

6. **访问应用**

打开浏览器访问 http://localhost:5173


### 📖 使用指南

1. **导入知识库**
点击「知识库管理」菜单

选择「导入文件」

填写文件所在文件夹
填写文件名，包括后缀，支持格式的文件（TXT、CSV、MD、HTML、DOCX、XLSX 等）

单击导入，系统自动解析并向量化文档

[知识库管理](./image/knowledge.jpg)

2. **开始对话**
点击「新对话」创建会话

输入您的问题

系统会检索知识库并结合大模型生成回答

回答会标注来源，方便验证

[对话](./image/chat.jpg)

3. 系统设置
在「设置」页面配置模型参数

可切换不同的大模型

调整温度、最大 Token 等参数

[设置](./image/setting.jpg)
### 开源协议
本项目采用 MIT 协议 开源。

### 💰 支持项目
如果您觉得 LocalAI 对您有帮助，欢迎打赏支持！

|支付宝 | 微信 |
|-------|------|
|[支付宝](https://github.com/xuqb1/localai/image/alipay.jpg) | [微信](https://github.com/xuqb1/localai/image/wechat.png) |

### 📞 联系方式
作者：xuqb1

邮箱：qb_xu@126.com

GitHub：https://github.com/xuqb1

### 🙏 致谢
DeepSeek - 提供强大的大语言模型

hnswlib - 高性能向量搜索库

Vue.js - 优秀的前端框架

Tailwind CSS - 实用的 CSS 框架

⭐ 如果这个项目对您有帮助，请给个 Star！
