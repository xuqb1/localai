# 🧠 LocalAI - Local Knowledge Base Q&A System

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT) [![Node.js](https://img.shields.io/badge/Node.js-18.x-339933?logo=node.js)](https://nodejs.org/) [![Vue.js](https://img.shields.io/badge/Vue.js-3.x-4FC08D?logo=vue.js)](https://vuejs.org/) [![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite)](https://vitejs.dev/)

LocalAI is an intelligent Q&A system based on a local knowledge base. It supports multiple document formats and combines with large language models (LLM) to provide accurate Q&A services. All data is stored locally, ensuring your privacy.

## ✨ Features

### 📚 Knowledge Base Management
- **Multi-format Support**: TXT, CSV, Markdown, HTML, Word, Excel and more
- **Batch Import**: Special a document or a directory with automatic parsing and vectorization
- **Smart Retrieval**: Fast knowledge retrieval using vector search technology
- **Visual Preview**: View imported knowledge base content

### 🤖 Intelligent Q&A
- **Hybrid Retrieval**: Combines knowledge base search with LLM capabilities
- **Streaming Response**: Real-time answer generation for better UX
- **Multi-model Support**: Supports DeepSeek, Agnes, and other LLMs
- **Conversation History**: Auto-saves chat history for reference

### ⚙️ System Settings
- **Model Configuration**: Flexible switching between different LLMs
- **Parameter Tuning**: Adjust temperature, max tokens, and other parameters
- **API Management**: Configure API keys for multiple models

## 🎯 Use Cases

- **Enterprise Knowledge Base**: Build internal document Q&A systems
- **Personal Knowledge Assistant**: Manage personal notes and documents
- **Customer Service**: Build intelligent support based on product documentation
- **Education & Training**: Create course material Q&A systems

## 🛠️ Tech Stack

### Backend
- **Node.js** - JavaScript runtime
- **Express** - Web framework
- **hnswlib-node** - High-performance vector index
- **better-sqlite3** - Lightweight database
- **Axios** - HTTP client

### Frontend
- **Vue 3** - Progressive JavaScript framework
- **Vite** - Fast build tool
- **Pinia** - Vue state management
- **Axios** - HTTP client
- **Tailwind CSS** - CSS framework
- **Lucide Vue** - Icon library

### Vectorization & AI
- **HNSW** - Approximate nearest neighbor search
- **DeepSeek API** - Large language model
- **Local Vector Storage** - Data localization for privacy

## 📦 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/localai.git
cd localai
```
Install backend dependencies
```bash
cd server
npm install
```
Install frontend dependencies
```bash
cd ../client
npm install
```
Configure environment variables

Create server/.env file:

```env
# DeepSeek API
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1

# Agnes API (optional)
AGNES_API_KEY=your_agnes_api_key
AGNES_BASE_URL=https://api.agnes.ai/v1

# Server configuration
PORT=3001
NODE_ENV=development
```
### Start services

1. **Start backend:**

```bash
cd server
npm run dev
```
2. **Start frontend (new terminal):**
```bash
cd client
npm run dev
```
3. **Access the application**

Open browser at http://localhost:5173

## 📖 User Guide
1. **Import Knowledge Base**
Click on "Knowledge Manage" menu

Select "Import File"

Special the directory and filename, supported files (TXT, CSV, MD, HTML, DOCX, XLSX, etc.)

Press Import button, then System automatically parses and vectorizes documents

2. **Start Chatting**
Click "New Chat" to create a session

Enter your question

System retrieves from knowledge base and generates answers

Answers include source references for verification

3. **System Settings**
Configure model parameters in "Settings"

Switch between different LLMs

Adjust temperature, max tokens, and other parameters

## 📄 License
This project is licensed under the MIT License.

## 💰 Support the Project
If LocalAI has been helpful to you, consider supporting us!

| Alipay | WeChat |
|--------|--------|
| https://github.com/xuqb1/localAI/image/alipay.jpg | https://github.com/xuqb1/localAI/image/wechat.jpg |

## 📞 Contact
Author: xuqb1

Email: qb_xu@126.com

GitHub: https://github.com/xuqb1

## 🙏 Acknowledgments
DeepSeek - Powerful LLM

hnswlib - High-performance vector search

Vue.js - Excellent frontend framework

Tailwind CSS - Practical CSS framework

⭐ If this project helps you, please give it a Star!