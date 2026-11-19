import json,base64,struct,sys,subprocess,os,tempfile
src,dst=sys.argv[1],sys.argv[2]
keep=set(sys.argv[3].split(','))
j=json.load(open(src))
buf=base64.b64decode(j['buffers'][0]['uri'].split(',',1)[1])
# 不要なアニメを落とす
j['animations']=[a for a in j['animations'] if a['name'] in keep]
need=set()
def acc(i):
    if i is not None: need.add(i)
for m in j['meshes']:
    for p in m['primitives']:
        for v in p['attributes'].values(): acc(v)
        acc(p.get('indices'))
for s in j.get('skins',[]): acc(s.get('inverseBindMatrices'))
for a in j['animations']:
    for sm in a['samplers']: acc(sm['input']); acc(sm['output'])
# 画像は縮小して JPEG で埋め込む
imgs=[]
for im in j.get('images',[]):
    bv=j['bufferViews'][im['bufferView']]; data=buf[bv.get('byteOffset',0):bv.get('byteOffset',0)+bv['byteLength']]
    d=tempfile.mkdtemp(); p=os.path.join(d,'a.png'); open(p,'wb').write(data)
    q=os.path.join(d,'b.jpg'); subprocess.run(['sips','-Z','512','-s','format','jpeg','-s','formatOptions','70',p,'--out',q],check=True,capture_output=True)
    imgs.append(open(q,'rb').read())
out=bytearray(); newbv=[]; accbv={}
def add(data):
    while len(out)%4: out.append(0)
    off=len(out); out.extend(data); newbv.append({'buffer':0,'byteOffset':off,'byteLength':len(data)}); return len(newbv)-1
bvmap={}
for i in sorted(need):
    a=j['accessors'][i]; b=j['bufferViews'][a['bufferView']]
    key=a['bufferView']
    if key not in bvmap:
        data=buf[b.get('byteOffset',0):b.get('byteOffset',0)+b['byteLength']]
        nb=add(data); bvmap[key]=nb
        if 'byteStride' in b: newbv[nb]['byteStride']=b['byteStride']
        if 'target' in b: newbv[nb]['target']=b['target']
    a['bufferView']=bvmap[key]
# 使わないアクセサは無効化せず、必要な物だけ残す（添字の振り直し）
order=sorted(need); remap={o:k for k,o in enumerate(order)}
newacc=[j['accessors'][o] for o in order]
for m in j['meshes']:
    for p in m['primitives']:
        p['attributes']={k:remap[v] for k,v in p['attributes'].items()}
        if 'indices' in p: p['indices']=remap[p['indices']]
for s in j.get('skins',[]):
    if 'inverseBindMatrices' in s: s['inverseBindMatrices']=remap[s['inverseBindMatrices']]
for a in j['animations']:
    for sm in a['samplers']: sm['input']=remap[sm['input']]; sm['output']=remap[sm['output']]
j['accessors']=newacc
for k,d in enumerate(imgs):
    bi=add(d); j['images'][k]={'bufferView':bi,'mimeType':'image/jpeg'}
j['bufferViews']=newbv
while len(out)%4: out.append(0)
j['buffers']=[{'byteLength':len(out)}]
js=json.dumps(j,separators=(',',':')).encode()
while len(js)%4: js+=b' '
glb=struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(out))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(out),0x004E4942)+bytes(out)
open(dst,'wb').write(glb); print(dst,len(glb)//1024,'KB')
