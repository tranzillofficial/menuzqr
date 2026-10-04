type CategoryNode = {id:string;name:string;parent_id?:string|null};
export function categoryAncestors<T extends CategoryNode>(categories:T[], id:string):T[] {
 const nodes=new Map(categories.map(c=>[c.id,c]));const path:T[]=[];const seen=new Set<string>();let node=nodes.get(id);
 while(node&&!seen.has(node.id)){seen.add(node.id);path.unshift(node);node=node.parent_id?nodes.get(node.parent_id):undefined;}
 return path;
}
export function categoryPath<T extends CategoryNode>(categories:T[], id:string):string {
 return categoryAncestors(categories,id).map(c=>c.name).join(' / ');
}
export function categoryDescendants<T extends CategoryNode>(categories:T[], id:string):Set<string> {
 const found=new Set([id]);let changed=true;
 while(changed){changed=false;for(const c of categories)if(c.parent_id&&found.has(c.parent_id)&&!found.has(c.id)){found.add(c.id);changed=true;}}
 return found;
}
export function visibleCategories<T extends CategoryNode & {is_active:boolean}>(categories:T[]):T[] {
 const nodes=new Map(categories.map(c=>[c.id,c]));
 return categories.filter(c=>{const seen=new Set<string>();let node:T|undefined=c;while(node){if(!node.is_active||seen.has(node.id))return false;seen.add(node.id);if(!node.parent_id)return true;node=nodes.get(node.parent_id);if(!node)return false;}return true;});
}
