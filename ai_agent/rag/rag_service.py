import os

from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS


class HotelRAG:

    def __init__(self):

        self.embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )

        # FIX: "faiss_hotel_index" was a relative path, resolved against the
        # *current working directory* the server was launched from (e.g.
        # ai_agent/), not against this file's location. Since the index
        # actually lives at ai_agent/rag/faiss_hotel_index/, that lookup
        # always failed. Building an absolute path from this file's own
        # location makes it work regardless of where uvicorn is started from.
        index_path = os.path.join(os.path.dirname(__file__), "faiss_hotel_index")

        self.vectorstore = FAISS.load_local(
            index_path,
            self.embeddings,
            allow_dangerous_deserialization=True
        )

        self.retriever = self.vectorstore.as_retriever(
            search_kwargs={
                "k": 3
            }
        )

    def search(self, query: str):

        if not query or not query.strip():
            return []

        documents = self.retriever.invoke(
            query.strip()
        )

        results = []

        for document in documents:

            results.append({
                "content": document.page_content,
                "metadata": document.metadata
            })

        return results