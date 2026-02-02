from langchain_huggingface import ChatHuggingFace, HuggingFaceEndpoint
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, AIMessage

load_dotenv()

llm = HuggingFaceEndpoint(
    repo_id="google/gemma-2-9b-it",
    task="text-generation",
    temperature=0.1
)

model = ChatHuggingFace(llm=llm)   

#chat historty
chat_history = [
  
]



MAX_HISTORY = 20

while True:
    user_input = input("You: ")
    
    if user_input == "exit":
        break 
    chat_history.append(HumanMessage(content=user_input))
    chat_history = chat_history[-MAX_HISTORY:] #keep only last 20 messages
     
    result= model.invoke(chat_history)
    chat_history.append(AIMessage(content=result.content))
    chat_history = chat_history[-MAX_HISTORY:]

    print("AI:", result.content)

print("Chat ended.")
