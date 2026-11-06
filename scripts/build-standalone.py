from pathlib import Path
import base64,json,sys,re
site=Path(__file__).resolve().parent.parent
uri=lambda s:'data:text/javascript;base64,'+base64.b64encode(s.encode()).decode()
cache={}
def embed(path):
    path=path.resolve()
    if path in cache:return cache[path]
    source=path.read_text()
    pattern=r'''(from\s+|import\s+)(['"])(\./[^'"]+)\2'''
    def replace(m):
        child=path.parent/m.group(3).split('?')[0]
        return m.group(1)+json.dumps(embed(child))
    source=re.sub(pattern,replace,source)
    cache[path]=uri(source)
    return cache[path]
main=base64.b64decode(embed(site/'main.js').split(',',1)[1]).decode()
html=(site/'index.html').read_text().replace('"./vendor/three.module.js"',json.dumps(uri((site/'vendor/three.module.js').read_text())))
html=re.sub(r'<script type="module" src="\./main.js[^\"]*"></script>',lambda _: '<script type="module">'+main+'</script>',html)
html=html.replace('</body></html>','<!--\n'+(site/'vendor/LICENSE-three.txt').read_text()+'\n--></body></html>')
Path(sys.argv[1]).write_text(html)
print('Saved standalone app (PDF viewer downloads its library when needed)')
