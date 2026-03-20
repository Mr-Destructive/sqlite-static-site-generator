import llm
import sys
sys.path.insert(0, '/home/meet/code/sandbox/gemini-proxy')
from gemini_api import GeminiAPI


@llm.hookimpl
def register_models(register):
    register(GeminiModel())


class GeminiModel(llm.Model):
    model_id = "gemini-free"
    supports_tools = False

    def execute(self, prompt, stream, response, conversation):
        api = GeminiAPI()
        text = prompt.prompt
        
        try:
            result = api.ask(text, stream=False)
            return result
        except Exception as e:
            return f"Error: {e}"
