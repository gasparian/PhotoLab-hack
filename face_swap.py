#! /usr/bin/env python
import os
import cv2
import json
import argparse
import numpy as np
import scipy.spatial as spatial

## 3D Transform
def bilinear_interpolate(img, coords):
    """ Interpolates over every image channel
    http://en.wikipedia.org/wiki/Bilinear_interpolation
    :param img: max 3 channel image
    :param coords: 2 x _m_ array. 1st row = xcoords, 2nd row = ycoords
    :returns: array of interpolated pixels with same shape as coords
    """
    int_coords = np.int32(coords)
    x0, y0 = int_coords
    dx, dy = coords - int_coords

    # 4 Neighour pixels
    q11 = img[y0, x0]
    q21 = img[y0, x0 + 1]
    q12 = img[y0 + 1, x0]
    q22 = img[y0 + 1, x0 + 1]

    btm = q21.T * dx + q11.T * (1 - dx)
    top = q22.T * dx + q12.T * (1 - dx)
    inter_pixel = top * dy + btm * (1 - dy)

    return inter_pixel.T

def grid_coordinates(points):
    """ x,y grid coordinates within the ROI of supplied points
    :param points: points to generate grid coordinates
    :returns: array of (x, y) coordinates
    """
    xmin = np.min(points[:, 0])
    xmax = np.max(points[:, 0]) + 1
    ymin = np.min(points[:, 1])
    ymax = np.max(points[:, 1]) + 1
    return np.asarray([(x, y) for y in range(ymin, ymax)
                       for x in range(xmin, xmax)], np.uint32)

def process_warp(src_img, result_img, tri_affines, dst_points, delaunay):
    """
    Warp each triangle from the src_image only within the
    ROI of the destination image (points in dst_points).
    """
    roi_coords = grid_coordinates(dst_points)
    # indices to vertices. -1 if pixel is not in any triangle
    roi_tri_indices = delaunay.find_simplex(roi_coords)

    for simplex_index in range(len(delaunay.simplices)):
        coords = roi_coords[roi_tri_indices == simplex_index]
        num_coords = len(coords)
        out_coords = np.dot(tri_affines[simplex_index],
                            np.vstack((coords.T, np.ones(num_coords))))
        x, y = coords.T
        result_img[y, x] = bilinear_interpolate(src_img, out_coords)

    return None

def triangular_affine_matrices(vertices, src_points, dst_points):
    """
    Calculate the affine transformation matrix for each
    triangle (x,y) vertex from dst_points to src_points
    :param vertices: array of triplet indices to corners of triangle
    :param src_points: array of [x, y] points to landmarks for source image
    :param dst_points: array of [x, y] points to landmarks for destination image
    :returns: 2 x 3 affine matrix transformation for a triangle
    """
    ones = [1, 1, 1]
    for tri_indices in vertices:
        src_tri = np.vstack((src_points[tri_indices, :].T, ones))
        dst_tri = np.vstack((dst_points[tri_indices, :].T, ones))
        mat = np.dot(src_tri, np.linalg.inv(dst_tri))[:2, :]
        yield mat

def warp_image_3d(src_img, src_points, dst_points, dst_shape, dtype=np.uint8):
    rows, cols = dst_shape[:2]
    result_img = np.zeros((rows, cols, 3), dtype=dtype)

    delaunay = spatial.Delaunay(dst_points)
    tri_affines = np.asarray(list(triangular_affine_matrices(
        delaunay.simplices, src_points, dst_points)))

    process_warp(src_img, result_img, tri_affines, dst_points, delaunay)

    return result_img

## 2D Transform
def transformation_from_points(points1, points2):
    points1 = points1.astype(np.float64)
    points2 = points2.astype(np.float64)

    c1 = np.mean(points1, axis=0)
    c2 = np.mean(points2, axis=0)
    points1 -= c1
    points2 -= c2

    s1 = np.std(points1)
    s2 = np.std(points2)
    points1 /= s1
    points2 /= s2

    U, S, Vt = np.linalg.svd(np.dot(points1.T, points2))
    R = (np.dot(U, Vt)).T

    return np.vstack([np.hstack([s2 / s1 * R,
                                (c2.T - np.dot(s2 / s1 * R, c1.T))[:, np.newaxis]]),
                      np.array([[0., 0., 1.]])])

def warp_image_2d(im, M, dshape):
    output_im = np.zeros(dshape, dtype=im.dtype)
    cv2.warpAffine(im,
                   M[:2],
                   (dshape[1], dshape[0]),
                   dst=output_im,
                   borderMode=cv2.BORDER_TRANSPARENT,
                   flags=cv2.WARP_INVERSE_MAP)
    return output_im

## Generate Mask
def mask_from_points(size, points, radius=2):
    # radius == kernel size
    kernel = np.ones((radius, radius), np.uint8)

    mask = np.zeros(size, np.uint8)
    cv2.fillConvexPoly(mask, cv2.convexHull(points), 255)
    mask = cv2.erode(mask, kernel)

    return mask

## Color Correction
def correct_colours(im1, im2, landmarks1):
    COLOUR_CORRECT_BLUR_FRAC = 0.75
    LEFT_EYE_POINTS = list(range(42, 48))
    RIGHT_EYE_POINTS = list(range(36, 42))

    blur_amount = COLOUR_CORRECT_BLUR_FRAC * np.linalg.norm(
                              np.mean(landmarks1[LEFT_EYE_POINTS], axis=0) -
                              np.mean(landmarks1[RIGHT_EYE_POINTS], axis=0))
    blur_amount = int(blur_amount)
    if blur_amount % 2 == 0:
        blur_amount += 1
    im1_blur = cv2.GaussianBlur(im1, (blur_amount, blur_amount), 0)
    im2_blur = cv2.GaussianBlur(im2, (blur_amount, blur_amount), 0)

    # Avoid divide-by-zero errors.
    im2_blur = im2_blur.astype(int)
    im2_blur += 128*(im2_blur <= 1)

    result = im2.astype(np.float64) * im1_blur.astype(np.float64) / im2_blur.astype(np.float64)
    result = np.clip(result, 0, 255).astype(np.uint8)

    return result

## Copy-and-paste
def apply_mask(img, mask):
    """ Apply mask to supplied image
    :param img: max 3 channel image
    :param mask: [0-255] values in mask
    :returns: new image with mask applied
    """
    masked_img = np.copy(img)
    num_channels = 3
    for c in range(num_channels):
        masked_img[..., c] = img[..., c] * (mask / 255)

    return masked_img

## Alpha blending
def alpha_feathering(src_img, dest_img, img_mask, blur_radius=15):
    mask = cv2.blur(img_mask, (blur_radius, blur_radius))
    mask = mask / 255.0

    result_img = np.empty(src_img.shape, np.uint8)
    for i in range(3):
        result_img[..., i] = src_img[..., i] * mask + dest_img[..., i] * (1-mask)

    return result_img

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='FaceSwap Demo')
    parser.add_argument('--src_img', required=True, help='Path for source image')
    parser.add_argument('--dst_img', required=True, help='Path for target image')
    parser.add_argument('--mask_img', default=None, help='Path for mask image')
    parser.add_argument('--src_points', required=True, help='Path for source face points')
    parser.add_argument('--dst_points', required=True, help='Path for target face points')
    parser.add_argument('--out', required=True, help='Path for storing output image')
    args = parser.parse_args()

    # ## Debug
    # args.src_img = 'imgs/I.jpg'
    # args.src_points = 'results/I.points.json'
    # args.dst_img = 'imgs/multi_faces.jpg'
    # args.dst_points = 'results/multi_faces.points.json'
    # args.mask_img = None
    # args.out = 'results/output.jpg'

    # Read images
    src_img = cv2.imread(args.src_img)
    dst_img = cv2.imread(args.dst_img)
    # Array of corresponding points
    with open(args.src_points) as f:
        src_points = np.asarray(json.load(f))
    with open(args.dst_points) as f:
        dst_points = np.asarray(json.load(f))

    w, h = dst_img.shape[:2]
    ## 2d warp
    src_mask = mask_from_points(src_img.shape[:2], src_points)
    src_img = apply_mask(src_img, src_mask)
    # Correct Color for 2d warp
    warped_dst_img = warp_image_3d(dst_img, dst_points[:48], src_points[:48], src_img.shape[:2])
    src_img = correct_colours(warped_dst_img, src_img, src_points)
    # Warp
    warped_src_img = warp_image_2d(src_img, transformation_from_points(dst_points, src_points), (w, h, 3))
    ## Mask for blending
    if args.mask_img:
        mask = cv2.cvtColor(cv2.imread(args.mask_img), cv2.COLOR_BGR2GRAY)
    else:
        mask = mask_from_points((w, h), dst_points)
    mask_src = np.mean(warped_src_img, axis=2) > 0
    mask = np.asarray(mask*mask_src, dtype=np.uint8)
    ## Shrink the mask
    kernel = np.ones((1, 1), np.uint8)
    mask = cv2.erode(mask, kernel, iterations=1)
    ## Poisson Blending
    r = cv2.boundingRect(mask)
    center = ((r[0] + int(r[2] / 2), r[1] + int(r[3] / 2)))
    output = cv2.seamlessClone(warped_src_img, dst_img, mask, center, cv2.NORMAL_CLONE)

    dir_path = os.path.dirname(args.out)
    if not os.path.isdir(dir_path):
        os.makedirs(dir_path)

    cv2.imwrite(args.out, output)

    # ##For debug
    # cv2.imshow("Face Warped", warped_src_img)
    # cv2.imshow("Face Swapped(A)", src_img)
    # cv2.imshow("Face Swapped(B)", dst_img)
    # cv2.imshow("Face Swapped(A->B)", output)
    # cv2.waitKey(0)
    #
    # cv2.destroyAllWindows()