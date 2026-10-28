from app.services.opendota.jobs import extract_job_id


def test_extract_job_id_variants():
    assert extract_job_id({"job": {"jobId": 42}}) == 42
    assert extract_job_id({"jobId": "17"}) == 17
    assert extract_job_id({}) is None
    assert extract_job_id(None) is None
    assert extract_job_id({"job": {"jobId": True}}) is None
