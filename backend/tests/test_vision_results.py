import concurrent.futures
import os
import threading
import time
from types import SimpleNamespace

import pytest

from vision import RTDETRDetector, _confidence_from_env, _upload_limit_from_env


@pytest.mark.parametrize('value', ['', 'bad', 'nan', 'inf', '-inf', '-0.1', '1.01', '1e999'])
def test_invalid_confidence_setting_uses_finite_default(monkeypatch, value):
    monkeypatch.setenv('SKYDASH_RTDETR_CONFIDENCE', value)
    assert _confidence_from_env() == 0.35


@pytest.mark.parametrize('value,expected', [('0', 0), ('1', 1), ('0.75', 0.75), (' 0.5 ', 0.5)])
def test_valid_confidence_settings_preserve_boundaries(monkeypatch, value, expected):
    monkeypatch.setenv('SKYDASH_RTDETR_CONFIDENCE', value)
    assert _confidence_from_env() == expected


@pytest.mark.parametrize('value', ['', 'bad', 'nan', 'inf', '-1', '0', '1.5'])
def test_invalid_upload_limit_setting_keeps_bounded_default(monkeypatch, value):
    monkeypatch.setenv('SKYDASH_RTDETR_MAX_UPLOAD_BYTES', value)
    assert _upload_limit_from_env() == 8 * 1024 * 1024


@pytest.mark.parametrize('value,expected', [('1', 1), ('4096', 4096), (' 8192 ', 8192)])
def test_valid_upload_limit_settings(monkeypatch, value, expected):
    monkeypatch.setenv('SKYDASH_RTDETR_MAX_UPLOAD_BYTES', value)
    assert _upload_limit_from_env() == expected


def test_invalid_optional_vision_settings_do_not_prevent_app_import():
    import subprocess
    import sys
    import tempfile
    with tempfile.TemporaryDirectory() as temporary:
        result = subprocess.run([sys.executable, '-c',
            'import main, vision; assert vision.detector.confidence == 0.35; '
            'assert vision.MAX_UPLOAD_BYTES == 8388608'],
            env={**os.environ, 'SKYDASH_DB_PATH': os.path.join(temporary, 'test.db'),
                 'SKYDASH_DISABLE_DEMO_USERS': '1', 'SKYDASH_RTDETR_CONFIDENCE': 'bad',
                 'SKYDASH_RTDETR_MAX_UPLOAD_BYTES': 'bad'},
            capture_output=True, text=True, timeout=15)
    assert result.returncode == 0, result.stderr



class TensorValue:
    def __init__(self, value):
        self.value = value

    def item(self):
        return self.value

    def tolist(self):
        return self.value


def box(coords=None, class_id=0, confidence=0.9):
    return SimpleNamespace(xyxy=[TensorValue([1, 2, 10, 20] if coords is None else coords)],
                           cls=[TensorValue(class_id)], conf=[TensorValue(confidence)])


@pytest.mark.parametrize('invalid', [
    box([1, 2, 3]), box([1, 2, 3, 4, 5]), box([float('nan'), 2, 10, 20]),
    box([1, 2, float('inf'), 20]), box([-1, 2, 10, 20]), box([10, 2, 1, 20]),
    box([1, 20, 10, 2]), box([1, 2, 1, 20]), box(class_id=0.5), box(class_id=-1),
    box(class_id=float('inf')), box(confidence=float('nan')), box(confidence=1.1),
    box(confidence=-0.1), box(['bad', 2, 10, 20]), SimpleNamespace(),
])
def test_malformed_box_does_not_abort_other_detections(invalid):
    result = SimpleNamespace(names={0: 'person'}, boxes=[invalid, box()])
    assert RTDETRDetector._serialize_results([result]) == [
        {'label': 'person', 'class_id': 0, 'confidence': 0.9, 'bbox_xyxy': [1.0, 2.0, 10.0, 20.0]}]


@pytest.mark.parametrize('names,label', [({0: 'person'}, 'person'), (['person'], 'person'),
                                         (('person',), 'person'), ({}, '0'), (None, '0')])
def test_label_containers_and_missing_labels(names, label):
    result = SimpleNamespace(names=names, boxes=[box()])
    assert RTDETRDetector._serialize_results([result])[0]['label'] == label


def test_valid_boxes_are_sorted_and_zero_confidence_and_origin_are_preserved():
    result = SimpleNamespace(names={0: 'person'}, boxes=[box([0, 0, 1, 1], confidence=0), box(confidence=1)])
    detections = RTDETRDetector._serialize_results([result])
    assert [item['confidence'] for item in detections] == [1, 0]
    assert detections[1]['bbox_xyxy'] == [0, 0, 1, 1]
    assert RTDETRDetector._summarize(detections)['labels'] == {'person': 2}


def test_concurrent_inference_is_serialized_and_temp_files_are_removed():
    detector = RTDETRDetector()
    state_lock = threading.Lock()
    active = 0
    peak = 0
    paths = []

    def predict(path, **kwargs):
        nonlocal active, peak
        with state_lock:
            active += 1
            peak = max(peak, active)
            paths.append(path)
        try:
            assert os.path.exists(path)
            time.sleep(0.005)
            return []
        finally:
            with state_lock:
                active -= 1

    detector._model = SimpleNamespace(predict=predict)
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda _: detector.analyze_image(b'frame', 'frame.jpg', 'image/jpeg'), range(8)))
    assert peak == 1
    assert len(paths) == 8
    assert all(not os.path.exists(path) for path in paths)
    assert all(result['summary']['total'] == 0 for result in results)


def test_prediction_failure_removes_temp_file_and_releases_model_lock():
    detector = RTDETRDetector()
    paths = []

    def fail(path, **kwargs):
        paths.append(path)
        raise RuntimeError('inference failed')

    detector._model = SimpleNamespace(predict=fail)
    with pytest.raises(RuntimeError, match='inference failed'):
        detector.analyze_image(b'frame', 'frame.jpg', 'image/jpeg')
    assert not os.path.exists(paths[0])
    assert detector._inference_lock.acquire(blocking=False)
    detector._inference_lock.release()
    detector._model.predict = lambda *args, **kwargs: []
    assert detector.analyze_image(b'frame', 'frame.jpg', 'image/jpeg')['summary']['total'] == 0
