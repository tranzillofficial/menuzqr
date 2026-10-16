#!/usr/bin/env python3
"""Prepare repeatable staging rows, retaining source evidence; never publishes or uploads images.
Manifest mapping is explicit because uploader column names are not assumed.
"""
import argparse, csv, hashlib, json, pathlib, re, unicodedata, uuid, zipfile
CATEGORIES={'مخبوزات':'bakery','مشروبات':'beverages','ألبان وجبن':'dairy_and_cheese','منظفات ومستلزمات منزلية':'detergents_and_household','مواد غذائية':'food_products','مجمدات ولحوم':'frozen_and_meat','خضار وفاكهة':'fruits_and_vegetables','عناية شخصية':'personal_care','مقرمشات وشوكولاتة':'snacks_and_chocolate'}
NS=uuid.UUID('8dd24c18-3209-4620-9a3f-37cff116c463')
def gtin_valid(code):
 if not re.fullmatch(r'(?:\d{8}|\d{12}|\d{13}|\d{14})',code): return False
 return (10-sum(int(n)*(3 if i%2==0 else 1) for i,n in enumerate(reversed(code[:-1])))%10)%10==int(code[-1])
def prepare(archive,manifest=None,columns=None):
 rows=[];images=[];seen={};manifest_index={};stats={'products':0,'image_links':0,'duplicate_source_ids':0,'barcode_checksum_valid':0,'barcode_verified':0,'review_reasons':{}}
 if manifest:
  with open(manifest,encoding='utf-8-sig',newline='') as f:
   reader=csv.DictReader(f)
   if not columns or not set(columns.values())<=set(reader.fieldnames or []):raise ValueError('Supply --manifest-columns JSON mapping category, filename, url, file_id, file_path to actual CSV headers.')
   for raw in reader:
    row={k:raw[v] for k,v in columns.items()}
    if not row['url'].startswith('https://') or not row['file_id']:raise ValueError('Manifest must contain real HTTPS URLs and file IDs.')
    manifest_index.setdefault((row['category'],pathlib.PurePath(row['filename'].replace('\\','/')).name),[]).append((row,raw))
 with zipfile.ZipFile(archive) as z:
  for name in sorted(z.namelist()):
   category=CATEGORIES.get(pathlib.PurePosixPath(name).stem)
   if not category:continue
   for original in json.loads(z.read(name)):
    external=original.get('external_id')
    if not isinstance(external,str) or not external:raise ValueError('Missing source external_id; refusing unstable identity.')
    if external in seen:
     if seen[external]!=original:raise ValueError('Conflicting repeated external_id: '+external)
     stats['duplicate_source_ids']+=1;continue
    seen[external]=original
    code=str(original.get('barcode_candidate') or '').strip();valid=gtin_valid(code);reasons=[]
    if original.get('needs_review'):reasons.append('source_flagged')
    if not valid:reasons.append('invalid_or_missing_gtin')
    if valid:stats['barcode_checksum_valid']+=1
    # Valid checksum is not proof of a physical barcode or a product match.
    verified=valid and original.get('barcode_verified') is True
    if not verified:reasons.append('barcode_requires_evidence')
    if code.startswith('2'):reasons.append('possible_retailer_or_variable_weight_code');verified=False
    if verified:stats['barcode_verified']+=1
    product_id=str(uuid.uuid5(NS,external))
    title=re.sub(r'\s+',' ',unicodedata.normalize('NFC',original.get('name_ar',''))).strip()
    if not title:reasons.append('missing_name')
    row={'id':product_id,'external_id':external,'name_ar':title,'brand':original.get('brand'),'category':category,'size':original.get('size'),'size_unit':original.get('size_unit'),'barcode_candidate':code or None,'barcode':code if verified else None,'barcode_verified':verified,'source_data':original,'review_reasons':reasons,'review_status':'pending'}
    rows.append(row)
    filename=pathlib.PurePath(str(original.get('image_reference_not_uploaded','')).replace('\\','/')).name
    for image,raw in manifest_index.get((category,filename),[]):
     images.append({'id':str(uuid.uuid5(NS,external+':'+image['file_id'])),'product_id':product_id,'file_id':image['file_id'],'url':image['url'],'file_path':image['file_path'],'rights_status':'pending','source_data':raw})
    for reason in reasons:stats['review_reasons'][reason]=stats['review_reasons'].get(reason,0)+1
 stats.update(products=len(rows),image_links=len(images),source_sha256=hashlib.sha256(pathlib.Path(archive).read_bytes()).hexdigest())
 return rows,images,stats
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('archive');p.add_argument('--manifest');p.add_argument('--manifest-columns',type=json.loads);p.add_argument('--output',required=True);a=p.parse_args()
 rows,images,stats=prepare(a.archive,a.manifest,a.manifest_columns);out=pathlib.Path(a.output);out.mkdir(parents=True,exist_ok=True)
 for name,data in [('products',rows),('images',images),('report',stats)]: (out/(name+'.json')).write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps(stats,ensure_ascii=False))
