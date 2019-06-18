from flask import Flask, render_template, url_for, request, send_from_directory
from flask_bootstrap import Bootstrap
from flask import jsonify
import numpy as np

from skimage.segmentation import slic
from skimage.segmentation import mark_boundaries
from skimage.data import astronaut
from skimage.util import img_as_float
import maxflow
from scipy.spatial import Delaunay

from graph_cut import *

app = Flask(__name__)
bootstrap = Bootstrap(app)

n_segments = 1000
compactness = 20


@app.route("/")
def home():
    return render_template('home.html')


@app.route("/static/<path:path>")
def send_static(path):
    return send_from_directory('static', path)


@app.route("/get_slic", methods=['GET', 'POST'])
def get_slic():
    if request.method == 'POST':
        json = request.get_json(force=True)
        image = json["pixels"]
        image_width = int(json["width"])
        image_height = int(json["height"])
        
        image = np.array(list(image.values()))
        image = image.reshape((image_height, image_width, 4))
        image = image.astype(float) / 255
        
        segments = slic(image[:, :, :3], n_segments=n_segments, compactness=compactness)
        slic_image = mark_boundaries(image[:,:,:3], segments)
        
        # print(slic_image, slic_image.shape)
        alpha = np.ones((image_height, image_width))
        slic_image = np.dstack([slic_image, alpha])
        slic_image = slic_image * 255
        slic_image = slic_image.flatten()
        slic_image = slic_image.astype('uint8')

        resp = jsonify(
            image=slic_image.tolist()
        )
        return(resp)

@app.route("/segment", methods=['GET', 'POST'])
def segment():
    if request.method == 'POST':
        json = request.get_json(force=True)
        image = json["pixels"]
        marking = json["marking_pixels"]
        image_width = int(json["width"])
        image_height = int(json["height"])
        
        image = np.array(list(image.values()))
        image = image.reshape((image_height, image_width, 4))
        image = image.astype(float) / 255

        marking = np.array(list(marking.values()))
        marking = marking.reshape((image_height, image_width, 4))
        # marking = marking.astype(float) / 255

        ###
        centers, colors_hists, segments, neighbors = superpixels_histograms_neighbors(image[:,:,:3])
        fg_segments, bg_segments = find_superpixels_under_marking(marking[:,:,:3], segments)

        # get cumulative BG/FG histograms, before normalization
        fg_cumulative_hist = cumulative_histogram_for_superpixels(fg_segments, colors_hists)
        bg_cumulative_hist = cumulative_histogram_for_superpixels(bg_segments, colors_hists)

        norm_hists = normalize_histograms(colors_hists)

        graph_cut = do_graph_cut((fg_cumulative_hist, bg_cumulative_hist),
                                (fg_segments,        bg_segments),
                                norm_hists,
                                neighbors)

        segmask = pixels_for_segment_selection(segments, np.nonzero(graph_cut))

        # image[:, :, 2] = segmask[:, :]
        image[:, :, 2][segmask == 1] = 1
        image = image * 255
        image = image.flatten()
        image = image.astype('uint8')

        alpha = np.ones((image_height, image_width))
        segmask = np.dstack([segmask]*3 + [alpha]) * 255
        segmask = segmask.flatten()
        segmask = segmask.astype('uint8')

        resp = jsonify(
            image=image.tolist(),
            segmask=segmask.tolist()
        )
        return(resp) 


if __name__ == '__main__':
    app.run(debug=True)
