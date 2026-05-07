# Google NotebookLM Clone

A Retrieval-Augmented Generation (RAG) application that allows you to upload a document (PDF/TXT) and have a conversation with it.

## Features

* **Upload Documents**: Upload any PDF document to extract its text.
* **Intelligent Chunking**: The text is chunked using LangChain's `RecursiveCharacterTextSplitter`.
* **Vector Store**: Chunks are embedded using Google Gemini (`text-embedding-004`) and stored in **Qdrant**.
* **Smart Retrieval**: User queries retrieve the top most relevant chunks from Qdrant.
* **Grounded Generation**: The LLM (`gemini-2.5-flash`) answers the query using strictly the retrieved context.

## RAG Pipeline Documentation

1. **Ingestion**: We use `multer` to handle file uploads and `pdf-parse` to extract text from PDFs.
2. **Chunking**: `RecursiveCharacterTextSplitter` is used to split the text into manageable chunks of 1000 characters with an overlap of 200 characters. This ensures that context isn't aggressively cut in the middle of sentences.
3. **Embedding**: The text chunks are passed to Gemini's embedding model to generate numerical vectors.
4. **Storage**: Vectors are indexed into a new collection in Qdrant Vector DB for fast similarity search.
5. **Retrieval**: When a query is made, it's embedded and compared against the stored vectors in Qdrant to pull the top 5 relevant chunks.
6. **Generation**: The retrieved chunks are formatted into a context string and sent to the Gemini LLM with a strict system prompt to ensure answers are grounded in the document (minimizing hallucination).

## Setup Instructions

### Prerequisites
* Node.js
* Docker (for local Qdrant)
* Google Gemini API Key

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file based on your environment:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   PORT=3000
   QDRANT_URL=http://localhost:6333
   ```

3. Start Qdrant (local vector DB):
   ```bash
   docker-compose up -d
   ```

4. Start the Server:
   ```bash
   npm start
   ```

5. Open your browser and go to `http://localhost:3000`

## Deployment

To deploy this online for your assignment "Live Project Link":
1. **Vector DB**: Create a free cluster on [Qdrant Cloud](https://cloud.qdrant.io/). Get the cluster URL and API key.
2. **Environment Variables**: Add the `QDRANT_URL` (and setup auth if needed) and your `GEMINI_API_KEY` to your hosting provider's environment secrets.
3. **App Hosting**: Push this repository to GitHub and connect it to Render, Vercel, or Heroku to host the Express web application.
