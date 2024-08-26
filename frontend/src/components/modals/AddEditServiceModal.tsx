import { addService, editService } from "@/utils/queries";
import { Service } from "@/utils/types";
import { Button, Group, Modal, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

export const AddEditServiceModal = ({ open, onClose, service, edit }:{ open?:boolean, onClose: ()=>void, service?:Service, edit?:boolean }) => {

    const form = useForm({
        initialValues: {
            name: service?.name,
        },
        validate: {
            name: (val) => {
                if (val == "") return "Name is required"
            }
        }
    })
    const queryClient = useQueryClient()

    useEffect(() => {
        form.setInitialValues({
            name: service?.name??""
        })
        form.reset()
    }, [service, open])

    return <Modal
        opened={open || service != null}
        onClose={onClose}
        title={edit?"Edit service":"Add service"}
        size="xl"
        centered
    >
        <form onSubmit={form.onSubmit((data) => {
            if (edit){
                if (service == null){
                    onClose()
                    return
                }
                editService(service.id, { name: data.name })
                .then(()=>{
                    notifications.show({
                        title: "Service edited!",
                        message: "Service has been edited successfully!",
                        color: "green",
                    })
                    queryClient.invalidateQueries({ queryKey: ["status"] })
                }).catch((err) => {
                    notifications.show({
                        title: "Error during editing!",
                        message: err.message??err??"Unknown error",
                        color: "red",
                    })
                }).finally(()=>{ onClose() })
            }else{
                addService({ name: data.name })
                .then(()=>{
                    notifications.show({
                        title: "Service added!",
                        message: "Service has been added successfully!",
                        color: "green",
                    })
                    queryClient.invalidateQueries({ queryKey: ["status"] })
                }).catch((err) => {
                    notifications.show({
                        title: "Error during adding!",
                        message: err.message??err??"Unknown error",
                        color: "red",
                    })
                }).finally(()=>{ onClose() })
            }
        })}>
            <TextInput
                label="Name"
                placeholder="Service name"
                withAsterisk
                {...form.getInputProps("name")}
            />
            <Group mt="lg" justify="flex-end">
                <Button onClick={form.reset} color="gray" disabled={!form.isDirty()}>Reset</Button>
                <Button type="submit" color="blue" disabled={!form.isValid() || !form.isDirty()}>{edit?"Edit":"Create"}</Button>
            </Group>
        </form>
    </Modal>
}