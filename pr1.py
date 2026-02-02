from langchain_huggingface import ChatHuggingFace, HuggingFaceEndpoint
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, AIMessage , SystemMessage
from langchain_core.prompts import PromptTemplate

load_dotenv()

llm = HuggingFaceEndpoint(
    repo_id="google/gemma-2-9b-it",
    task="text-generation",
    temperature=0.1
)

model = ChatHuggingFace(llm=llm)   

MAX_HISTORY = 20

intent_prompt = PromptTemplate(
    input_variables=["message"],
    template="""
You are an intent classification system.

Classify the intent of the user message.
Choose ONLY one intent from:
- send_email
- schedule_meeting
- general_chat

User message: "{message}"

Respond with ONLY the intent name.
"""
)



#chat historty
chat_history = []

#intent classifier
def detect_intent(text: str)-> str  :
    prompt = intent_prompt.format(message=text)
    response = model.invoke([HumanMessage(content=prompt)])
    return response.content.strip()

print(" Intelligent Task Automation Agent")
print("Type 'exit' to quit.\n")

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
