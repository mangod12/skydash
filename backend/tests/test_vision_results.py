from types import SimpleNamespace

import pytest

from vision import RTDETRDetector


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
