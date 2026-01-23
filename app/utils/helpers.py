from bson import ObjectId
from datetime import datetime
from typing import Any, Dict

def serialize_doc(doc: Any) -> Any:
    """Convert MongoDB document to JSON-serializable dict."""
    if doc is None:
        return None
    
    if isinstance(doc, list):
        return [serialize_doc(item) for item in doc]
    
    if isinstance(doc, datetime):
        return doc.isoformat()
        
    if isinstance(doc, ObjectId):
        return str(doc)
    
    if not isinstance(doc, dict):
        return doc
    
    serialized = {}
    for key, value in doc.items():
        if isinstance(value, ObjectId):
            serialized[key if key != '_id' else 'id'] = str(value)
        elif isinstance(value, datetime):
            serialized[key] = value.isoformat()
        elif isinstance(value, dict):
            serialized[key] = serialize_doc(value)
        elif isinstance(value, list):
            serialized[key] = [serialize_doc(item) for item in value]
        else:
            serialized[key] = value
    
    return serialized
