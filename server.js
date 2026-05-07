import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import { fileURLToPath } from 'url';

// LangChain imports
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document } from '@langchain/core/documents';
import { QdrantVectorStore } from '@langchain/qdrant';
import { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } from '@langchain/google-genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Setup multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Global variable to store current collection name
let currentCollectionName = "notebooklm-clone-default";

// Embedding Model setup
const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GEMINI_API_KEY,
    model: "gemini-embedding-2", // Gemini's embedding model
});

// Qdrant setup
const qdrantUrl = process.env.QDRANT_URL || "http://localhost:6333";

// LLM setup
const llm = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    apiKey: process.env.GEMINI_API_KEY,
    temperature: 0.2,
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const filePath = req.file.originalname;
        console.log(`Processing file: ${req.file.originalname}`);

        // 1. Ingestion: Extract text from PDF from buffer
        const dataBuffer = req.file.buffer;
        const pdfData = await pdfParse(dataBuffer);
        const text = pdfData.text;

        // 2. Chunking: Split text into chunks
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
        const chunks = await textSplitter.splitText(text);

        // Convert string chunks to Document objects
        const docs = chunks.map((chunk, index) => new Document({
            pageContent: chunk,
            metadata: { source: req.file.originalname, chunk_id: index }
        }));

        console.log(`Created ${docs.length} chunks.`);

        // Unique collection name for this document to avoid collision
        currentCollectionName = `doc_${Date.now()}`;

        // 3. Embedding and Storage: Store in Qdrant Vector DB
        await QdrantVectorStore.fromDocuments(docs, embeddings, {
            url: qdrantUrl,
            collectionName: currentCollectionName,
        });

        console.log(`Indexed into Qdrant collection: ${currentCollectionName}`);

        res.json({ message: 'Document successfully processed and indexed.', chunkCount: docs.length });
    } catch (error) {
        console.error("Error during upload/processing:", error);
        res.status(500).json({ error: 'Failed to process document: ' + error.message });
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        // 4. Retrieval: Connect to existing collection and search
        const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
            url: qdrantUrl,
            collectionName: currentCollectionName,
        });

        const retriever = vectorStore.asRetriever({ k: 5 }); // Top 5 relevant chunks
        const relevantDocs = await retriever.invoke(query);

        // Format context from retrieved documents
        const context = relevantDocs.map(doc => doc.pageContent).join('\n\n');

        // 5. Generation: Use LLM with strict prompt
        const systemPrompt = `You are an AI Assistant that answers user queries strictly based on the provided context.
        
        Rules:
        - Only answer based on the available context from the uploaded document.
        - If the answer is not in the context, say "I cannot answer this based on the provided document."
        - Do not use outside knowledge.
        
        Context:
        ${context}
        `;

        const response = await llm.invoke([
            ["system", systemPrompt],
            ["human", query]
        ]);

        res.json({ answer: response.content, sources: relevantDocs });
    } catch (error) {
        console.error("Error during chat:", error);
        res.status(500).json({ error: 'Failed to process query: ' + error.message });
    }
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}

export default app;
