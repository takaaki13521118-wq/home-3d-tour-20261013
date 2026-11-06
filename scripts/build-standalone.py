from pathlib import Path
import base64,json,sys
site=Path(__file__).resolve().parent.parent
uri=lambda s:'data:text/javascript;base64,'+base64.b64encode(s.encode()).decode()
main=(site/'main.js').read_text()
for module in ('vendor/OrbitControls.js','house-core.mjs','joystick.mjs'):
    main=main.replace("'./"+module+("?v=20261107-level" if module=="joystick.mjs" else "")+"'",json.dumps(uri((site/module).read_text())))
html=(site/'index.html').read_text().replace('"./vendor/three.module.js"',json.dumps(uri((site/'vendor/three.module.js').read_text())))
html=html.replace('<script type="module" src="./main.js?v=20261107-level"></script>','<script type="module">'+main+'</script>')
html=html.replace('</body></html>','<!--\n'+(site/'vendor/LICENSE-three.txt').read_text()+'\n--></body></html>')
Path(sys.argv[1]).write_text(html)
print('Saved standalone app')
