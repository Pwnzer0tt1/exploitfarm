from multiprocessing import Process, Manager
from db import *
from models.all import *
import logging, uvloop, sys
from typing import List
from utils import Scheduler
from datetime import timedelta
from utils import datetime_now
import env, traceback

class StopLoop(Exception): pass

async def update_db_structures():
    g.config = await Configuration.get_from_db()
    g.submitters = await Submitter.objects.all()

def raw_submit_task_execution(submitter:Submitter, flags: List[str], return_dict: dict):
    from io import StringIO
    import sys
    
    return_dict["ok"] = False
    return_dict["error"] = "Submitter failed (probably kille due to SUBMITTER_TIMEOUT)"
    
    string_io_buffer = StringIO()
    
    sys.stdout = string_io_buffer
    sys.stderr = string_io_buffer
    
    try:
        set_warning = False
        glob = {}
        try:
            exec(submitter.code, glob) #Probably it's not me :(, See the errors below
        except Exception as e:
            logging.error(f"Submitter {submitter.id} failed: {e}")
            print(f"Submitter {submitter.id} failed: {e}\n-------------------------------")
            traceback.print_exc()
            return_dict["error"] = "Submitter setup error: " + str(e)
            return
        try:
            results = glob["submit"](flags, **{k:v["value"] for k, v in submitter.kargs.items()}) #Probably it's not me :(, See the errors below
            try:
                results = list(results)
            except Exception:
                raise Exception("The sumbitter doesn't return a list or iterable object!")
            filtered_results = []
            for f in list(results):
                try:
                    if not isinstance(f[0], str) or not isinstance(f[1], str) or not isinstance(f[2], str):
                        set_warning = True
                        print(f"WARNING: found an invalid response from submitter: the elements of every tuple must contain 3 strings, found: {type(f[0])}, {type(f[1])}, {type(f[2])}")
                        continue
                    try:
                        FlagStatus(f[1])
                    except Exception:
                        set_warning = True
                        print("WARNING: found an invalid response from submitter: second element must be a valid FlagStatus")
                        continue
                    filtered_results.append(f[:3])
                except Exception:
                    set_warning = True
                    print("WARNING: found an invalid response from submitter: must be [(flag, status, msg), ...]")
            del return_dict["error"]
            if set_warning:
                return_dict["warning"] = True
            return_dict["ok"] = True
            return_dict["results"] = filtered_results
        except Exception as e:
            logging.error(f"Submitter {submitter.id} failed: {e}")
            print(f"Submitter {submitter.id} failed: {e}\n-------------------------------")
            traceback.print_exc()
            return_dict["error"] = str(e)
    except KeyboardInterrupt:
        logging.info("Submitter loop stopped by KeyboardInterrupt")
    finally:
        return_dict["output"] = string_io_buffer.getvalue()

def submit_task_fork(submitter:Submitter, flags: List[str], submitter_timeout:int):
    return_dict = Manager().dict()
    process = Process(target=raw_submit_task_execution, args=(submitter, flags, return_dict), )
    process.start()
    process.join(submitter_timeout)
    return return_dict.copy()

async def run_submit_routine(flags: List[Flag]):    
    submitter = list(filter(lambda x: x.id == g.config.SUBMITTER, g.submitters))
    if len(submitter) == 0:
        logging.error(f"Submitter {g.config.SUBMITTER} not found, unexpected behavior!")
        return
    submitter = submitter[0]
    try:
        return_dict = submit_task_fork(submitter, [flag.flag for flag in flags], g.config.SUBMITTER_TIMEOUT)
    except Exception as e:
        logging.error(f"Submitter {submitter.id} failed: {e}")
        for f in flags:
            f.status_text = str(e)
            f.last_submission_at = datetime_now()
            f.submit_attempts += 1
        await Flag.objects.bulk_update(flags)
        return
    
    if not "ok" in return_dict or not return_dict["ok"]:
        if not "error" in return_dict or not "output" in return_dict:
            logging.error(f"Submitter {submitter.id} failed: killed by SUBMITTER_TIMEOUT")
            await create_or_update_env("SUBMITTER_ERROR_OUTPUT", "killed by SUBMITTER_TIMEOUT (no data recieved from submit)")
            return
        logging.error(f"Submitter {submitter.id} failed: {return_dict['error']}")
        await create_or_update_env("SUBMITTER_ERROR_OUTPUT", return_dict["output"] if return_dict["output"] else "An error without output was generated") #Put the error in the db
        print("\n\n-------------- SUBMITTER OUTPUT --------------\n\n", return_dict["output"], "\n\n------------ SUBMITTER OUTPUT END ------------\n\n", sep="")
        for f in flags:
            f.status_text = return_dict["error"]
            f.last_submission_at = datetime_now()
            f.submit_attempts += 1
        await Flag.objects.bulk_update(flags)
        return
    else:
        await create_or_update_env("SUBMITTER_ERROR_OUTPUT", "") #Clear the error output
    
    if "warning" in return_dict and return_dict["warning"]:
        await create_or_update_env("SUBMITTER_WARNING_OUTPUT", return_dict["output"] if return_dict["output"] else "A warning without output was generated") #Put the output in the db
    else:
        await create_or_update_env("SUBMITTER_WARNING_OUTPUT", "")
    
    results_dict = {ele[0]:ele[1:] for ele in return_dict["results"]}
    
    if len(results_dict.keys()) != len(flags):
        await create_or_update_env("SUBMITTER_ERROR_OUTPUT", f"The submitter returned a different amount of flag status than the flags put in the submitter (given flags: {len(flags)}, returned flags: {len(results_dict.keys())}). Please check the submitter code.")
    
    for flag in flags:
        status, status_text = results_dict.get(flag.flag, (None, None))
        if status is None or status_text is None:       
            continue
        flag.submit_attempts += 1
        flag.last_submission_at = datetime_now()
        if status in [ele.value for ele in list(FlagStatus)]:
            flag.status = status
            flag.status_text = status_text
        else:
            flag.status_text = "The submitter return an invalid status! must be [(flag, status, msg), ...]"
    await Flag.objects.bulk_update(flags)

        


async def submit_flags_task():
    if g.config.FLAG_TIMEOUT:
        expired_elements = await Flag.objects.filter(
            ((datetime_now() - timedelta(seconds=g.config.FLAG_TIMEOUT)) > Flag.attack.recieved_at) & (Flag.status == FlagStatus.wait.value) & (Flag.submit_attempts > 0)
        ).all()
        if len(expired_elements) > 0:
            for flag in expired_elements:
                flag.status = FlagStatus.timeout.value
                flag.status_text = "⚠️ Timeouted by Exploitfarm due to FLAG_TIMEOUT"
            await Flag.objects.bulk_update(expired_elements)
    flags_to_submit = Flag.objects.filter(status=FlagStatus.wait.value).order_by(Flag.attack.recieved_at.asc())
    if g.config.FLAG_SUBMIT_LIMIT is None:
        flags_to_submit = await flags_to_submit.all()
    else:
        flags_to_submit = await flags_to_submit.limit(g.config.FLAG_SUBMIT_LIMIT).all()
    if len(flags_to_submit) == 0:  
        return g.flag_submit.reset_exec()
    await run_submit_routine(flags_to_submit)

class g:
    flag_submit = Scheduler(submit_flags_task)
    structure_update = Scheduler(update_db_structures, env.FLAG_UPDATE_POLLING)
    config:Configuration = None
    submitters:List[Submitter] = None

async def loop():
    await g.structure_update.commit()
    if g.config.SETUP_STATUS == SetupStatus.SETUP:
        return
    if g.config.SUBMITTER is None:
        if len(g.submitters) == 0:
            return
        else:
            g.config.SUBMITTER = g.submitters[0].id
            await g.config.write_on_db()
            logging.warning(f"Submitter not set, using id:{g.config.SUBMITTER} as fallback submitter")
    g.flag_submit.interval = g.config.SUBMIT_DELAY
    await g.flag_submit.commit()

#Loop based process with a half of a second of delay
async def loop_init():
    try:
        await connect_db()
        await update_db_structures()
        logging.info("Submitter loop started")
        while True:
            await loop()
            await asyncio.sleep(0.3)
    except KeyboardInterrupt:
        pass
    finally:
        await close_db()

def inital_setup():
    try:
        while True:
            try:
                if sys.version_info >= (3, 11):
                    with asyncio.Runner(loop_factory=uvloop.new_event_loop) as runner:
                        runner.run(loop_init())
                else:
                    uvloop.install()
                    asyncio.run(loop_init())
            except Exception as e:
                traceback.print_exc()
                logging.exception(f"Submitter loop failed: {e}, restarting loop")
    except (KeyboardInterrupt, StopLoop):
        logging.info("Submitter stopped by KeyboardInterrupt")

def run_submitter_daemon() -> Process:
    p = Process(target=inital_setup)
    p.start()
    return p