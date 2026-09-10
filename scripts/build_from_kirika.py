python -c "
import urllib.request, zipfile, io, os

url = 'https://github.com/huxingyi/autoremesher/files/5359133/Kirika.bikini.zip'
print('Downloading Kirika.bikini.zip...')
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
content = urllib.request.urlopen(req).read()

with zipfile.ZipFile(io.BytesIO(content)) as z:
    z.printdir()
    z.extractall('public/models/kirika')
print('Extracted to public/models/kirika!')
"