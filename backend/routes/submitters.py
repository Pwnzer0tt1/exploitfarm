from models.submitter import *
from models.response import *
from models.config import *
from db import Submitter
from typing import List
from fastapi import APIRouter, HTTPException
from utils import *
import re

router = APIRouter(prefix="/submitters", tags=["Submitters"])

@router.post("", response_model=MessageResponse[SubmitterDTO])
async def new_submitter(data: SubmitterAddForm):
    """ Set the submitter code """
    submit_function, error = extract_submit(data.code)
    
    if not submit_function:
        raise HTTPException(400, error)
    
    valid_sig, msg = has_submit_signature(submit_function)
    if not valid_sig: raise HTTPException(400, msg)
    
    kargs = get_additional_args(submit_function)
    
    #Set custom kargs
    if data.kargs:
        for k,v in data.kargs.items():
            if k not in kargs.keys():
                raise HTTPException(400, f"Invalid key {k}")
            kargs[k]["value"] = v
            
    #Check enforced type for kwargs
    for k,v in kargs.items():
        if not type_check_annotation(v["value"], v["type"]):
            raise HTTPException(400, f"Invalid type for {k} ({v['value']} is not of type {v['type']})")
    
    submitter = await Submitter(name=data.name, code=data.code, kargs=kargs).save()
    
    return { "message": "The submitter has been created", "response": json_like(submitter)}

@router.post("/check", response_model=MessageResponse[SubmitterKargs])
async def info_submitter(data: SubmitterInfoForm):
    """ Get information about the submitter code """
    submit_function, error = extract_submit(data.code)
    
    if not submit_function:
        raise MessageResponseInvalidError(error)
    
    valid_sig, msg = has_submit_signature(submit_function)
    if not valid_sig:
        raise MessageResponseInvalidError(msg)
    
    kargs = get_additional_args(submit_function)
    
    return { "message": "The submitter is valid", "response": kargs}

@router.get("", response_model=List[SubmitterDTO])
async def get_submitters():
    """ Get all the submitters """
    return await Submitter.objects.all()

@router.put("/{submitter_id}", response_model=MessageResponse[SubmitterDTO])
async def update_submitter(submitter_id: SubmitterID, data: SubmitterEditForm):
    """ Edit a submitter """
    submitter = await Submitter.objects.get_or_none(id=submitter_id)
    if not submitter:
        raise HTTPException(404, "Submitter not found")
    
    data.code = data.code if data.code else submitter.code
    submit_function, error = extract_submit(data.code)
    
    if not submit_function:
        raise HTTPException(400, error)
    
    valid_sig, msg = has_submit_signature(submit_function)
    if not valid_sig: raise HTTPException(400, msg)
    kargs = get_additional_args(submit_function)
    
    #Setting old values
    for k,v in kargs.items():
        if k in submitter.kargs.keys():
            kargs[k]["value"] = submitter.kargs[k]["value"]
    #Old values filtered and saved in submitter
    submitter.kargs = kargs
    
    #Apply edit on data.kargs
    if data.kargs:
        for k,v in data.kargs.items():
            if k not in submitter.kargs.keys():
                raise HTTPException(400, f"Invalid key {k}")
            data.kargs[k] = { "value":v, "type": submitter.kargs[k]["type"] }
    else:
        data.kargs = submitter.kargs

    #Check enforced type for kwargs
    for k,v in data.kargs.items():
        if not type_check_annotation(v["value"], v["type"]):
            raise HTTPException(400, f"Invalid type for {k} ({v['value']} is not of type {v['type']})")

    await submitter.update(**json_like(data))
    return { "message": "The submitter has been updated", "response": json_like(submitter)}

@router.delete("/{submitter_id}", response_model=MessageResponse[SubmitterDTO])
async def delete_submitter(submitter_id: SubmitterID):
    """ Delete a submitter """
    config = await Configuration.get_from_db()
    if config.SUBMITTER == submitter_id:
        raise HTTPException(400, "Cannot delete the currently selected submitter (change it in configuration first)")
    submitter = await Submitter.objects.get_or_none(id=submitter_id)
    if not submitter:
        raise HTTPException(404, "Submitter not found")
    await submitter.delete()
    return { "message": "The submitter has been deleted", "response": json_like(submitter)}

@router.post("/{submitter_id}/test", response_model=MessageResponse[Dict[str, Any]])
async def test_submitter(submitter_id: SubmitterID, data: List[str]):
    """ Test the submitter (Flags will not be stored in the database)"""
    config = await Configuration.get_from_db()
    submitter = await Submitter.objects.get_or_none(id=submitter_id)
    if not submitter:
        raise HTTPException(404, "Submitter not found")
    if config.FLAG_REGEX:
        data = [re.findall(config.FLAG_REGEX, ele) for ele in data]
        #Flatten the list
        data = [item for sublist in data for item in sublist]
    from submitter import submit_task_fork
    return { "message": "submitter task executed", "response": submit_task_fork(submitter, data, config.SUBMITTER_TIMEOUT) }