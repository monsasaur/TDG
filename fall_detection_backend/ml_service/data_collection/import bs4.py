import bs4
from PIL import Image
from filepond import FilepondEmbed
from filepond.plugins.resize import resize

def convert_to_jpg(image_path, output_path):
    with Image.open(image_path) as image:
        image.save(output_path)
        # Filepond Embed
        foib = FilepondEmbed()
        foib.api_id = "example-1"
        foib.api_key = "example-key"
        foib.color = "#F7F7F7"  # แส้นสีขาวอันใน
        foib.metadata = {
            "author": "Your Name",
            "description": "Your Description",
            "license": "MIT"
        }
        foib.save(output_path)

image_path = "source.png"
output_path = "output.jpg"
convert_to_jpg(image_path, output_path)