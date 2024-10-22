from models.service import *
from models.response import *
from db import Service
from utils import *
from typing import List
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/services", tags=["Services"])

@router.get("", response_model=List[ServiceDTO])
async def service_get():
    return await Service.objects.all()

@router.post("", response_model=MessageResponse[ServiceDTO])
async def service_new(data: ServiceAddForm):
    service = await Service.model_validate(json_like(data)).save()
    return { "message": "Service created successfully", "response": service }

@router.delete("/{service_id}", response_model=MessageResponse[ServiceDTO])
async def service_delete(service_id: ServiceID):
    service = await Service.objects.get_or_none(id=service_id)
    if not service:
        raise HTTPException(404, "Service not found")
    await service.delete()
    return { "message": "Service deleted successfully", "response": service }

@router.put("/{service_id}", response_model=MessageResponse[ServiceDTO])
async def service_edit(service_id: ServiceID, data: ServiceEditForm):
    service = await Service.objects.get_or_none(id=service_id)
    if not service:
        raise HTTPException(404, "Service not found")
    await service.update(**json_like(data))
    return { "message": "Service updated successfully", "response": service }