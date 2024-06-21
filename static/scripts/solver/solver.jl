using Pkg
# Pkg.add("LightGraphs")
# Pkg.add("GraphPlot")
# Pkg.add("Colors")
# Pkg.add("IterTools")
# Pkg.add("Images")
# Pkg.add("Plots")
using Graphs
using GraphPlot
using Colors
using IterTools
using HTTP
using JSON
using WebSockets: serve, writeguarded, readguarded, @wslog, open, HTTP, Response, ServerWS, with_logger, WebSocketLogger


function coord_to_index(x, y)
    return (x - 1) * 9 + y
end


all_groups = []
for y in 1:9
    push!(all_groups, [coord_to_index(1, y) coord_to_index(2, y) coord_to_index(3, y) coord_to_index(4, y)])
end
for y in 1:6
    push!(all_groups, [coord_to_index(1, y) coord_to_index(2, y+1) coord_to_index(3, y+2) coord_to_index(4, y+3)])
    push!(all_groups, [coord_to_index(1, y+3) coord_to_index(2, y+2) coord_to_index(3, y+1) coord_to_index(4, y)])
    for x in 1:4
        push!(all_groups, [coord_to_index(x, y) coord_to_index(x, y+1) coord_to_index(x, y+2) coord_to_index(x, y+3)])
    end
end


all_groups = reshape(vcat(all_groups...), 45, 4)
all_three_in_a_row = reshape(all_groups[:, [1 2 3; 1 2 4; 1 3 4; 2 3 4]], :, 3)
all_three_in_a_row * [10000 100 1]'
enc(x::Matrix)::Matrix = x * [10000 100 1]'
dec(x::Matrix)::Matrix = [div.(x, 10000) mod.(div.(x, 100),100) mod.(x, 100)]
all_three_in_a_row = all_three_in_a_row |> enc |> unique |> hcat |> dec
all_two_in_a_row = reshape(all_groups[:, [1 2; 1 3; 1 4; 2 3; 2 4; 3 4]], :, 2)
all_two_in_a_row * [100 1]'
enc(x::Matrix)::Matrix = x * [100 1]'
dec(x::Matrix)::Matrix = [div.(x, 100) mod.(x, 100)]
all_two_in_a_row = all_two_in_a_row |> enc |> unique |> hcat |> dec


function square_to_group(all_patterns)
    book = zeros(36, size(all_patterns)[1])
    for i in 1: size(all_patterns)[1]
        book[all_patterns[i, :], i] .= 1
    end
    return book
end
four_in_a_row = square_to_group(all_groups)
three_in_a_row = square_to_group(all_three_in_a_row)
two_in_a_row = square_to_group(all_two_in_a_row)


BlackTransMatrix = zeros(10, 10)
BlackTransMatrix[1, 3] = 1
BlackTransMatrix[2, 2] = 1
BlackTransMatrix[3, 4] = 1
BlackTransMatrix[4, 5] = 1
BlackTransMatrix[5, 6] = 1
BlackTransMatrix[6, 6] = 1
BlackTransMatrix[7, 2] = 1
BlackTransMatrix[8, 2] = 1
BlackTransMatrix[9, 2] = 1
BlackTransMatrix[10, 10] = 1

WhiteTransMatrix = zeros(10, 10)
WhiteTransMatrix[1, 7] = 1
WhiteTransMatrix[2, 2] = 1
WhiteTransMatrix[3, 2] = 1
WhiteTransMatrix[4, 2] = 1
WhiteTransMatrix[5, 2] = 1
WhiteTransMatrix[6, 6] = 1
WhiteTransMatrix[7, 8] = 1
WhiteTransMatrix[8, 9] = 1
WhiteTransMatrix[9, 10] = 1
WhiteTransMatrix[10, 10] = 1


function update(states::Matrix, square, color)
    matrix = color == "black" ? BlackTransMatrix : WhiteTransMatrix
    states[four_in_a_row[square, :] .== 1, :] *= matrix
end


function init_state(black, white)
    black = map(x -> x + 1, black)
    white = map(x -> x + 1, white)
    group_state = zeros(45, 10)
    group_state[:, 1] .= 1

    for b in black
        update(group_state, b, "black")
    end
    for w in white
        update(group_state, w, "white")
    end

    empty_squares = filter(x -> !((x in black) | (x in white)), 1:36)
    return group_state, empty_squares
end


function get_candidates(turn_color, empty_squares, group_state, remain_steps, is_player)
    oppo_color = turn_color == "black" ? "white" : "black"

    turn_3iar = all_groups[group_state[:, turn_color == "black" ? 5 : 9] .== 1, :]
    turn_3iar = intersect(unique(turn_3iar), empty_squares)
    if length(turn_3iar) > 0
        return turn_3iar, "Forced Win"
    end

    oppo_3iar = all_groups[group_state[:, oppo_color == "black" ? 5 : 9] .== 1, :]
    oppo_3iar = intersect(unique(oppo_3iar), empty_squares)
    if length(oppo_3iar) > 0
        return oppo_3iar, "Defense"
    end
    if is_player
        if remain_steps <= 3
            cand = all_groups[group_state[:, turn_color == "black" ? 4 : 8] .== 1, :]
            cand = intersect(unique(cand), empty_squares)
            return cand, "Other"
        elseif remain_steps <= 5
            cand_2iar = all_groups[group_state[:, turn_color == "black" ? 4 : 8] .== 1, :]
            cand_2iar = intersect(unique(cand_2iar), empty_squares)
            cand_1iar = all_groups[group_state[:, turn_color == "black" ? 3 : 7] .== 1, :]
            cand_1iar = intersect(unique(cand_1iar), empty_squares)
            return union(cand_2iar, cand_1iar), "Other"
        else
            cand_m2 = all_groups[group_state[:, turn_color == "black" ? 4 : 8] .== 1, :]
            cand_m2 = intersect(unique(cand_m2), empty_squares)
            cand_m1 = all_groups[group_state[:, turn_color == "black" ? 3 : 7] .== 1, :]
            cand_m1 = intersect(unique(cand_m1), empty_squares)
            cand_o2 = all_groups[group_state[:, turn_color == "black" ? 8 : 4] .== 1, :]
            cand_o2 = intersect(unique(cand_o2), empty_squares)
            cand_o1 = all_groups[group_state[:, turn_color == "black" ? 7 : 3] .== 1, :]
            cand_o1 = intersect(unique(cand_o1), empty_squares)
            cand_e = all_groups[group_state[:, 1] .== 1, :]
            cand_e = intersect(unique(cand_e), empty_squares)
            return union(cand_m2, cand_m1, cand_e, cand_o1, cand_o2), "Other"
        end
    else
        cand_m2 = all_groups[group_state[:, turn_color == "black" ? 4 : 8] .== 1, :]
        cand_m2 = intersect(unique(cand_m2), empty_squares)
        cand_m1 = all_groups[group_state[:, turn_color == "black" ? 3 : 7] .== 1, :]
        cand_m1 = intersect(unique(cand_m1), empty_squares)
        cand_o2 = all_groups[group_state[:, turn_color == "black" ? 8 : 4] .== 1, :]
        cand_o2 = intersect(unique(cand_o2), empty_squares)
        cand_o1 = all_groups[group_state[:, turn_color == "black" ? 7 : 3] .== 1, :]
        cand_o1 = intersect(unique(cand_o1), empty_squares)
        cand_e = all_groups[group_state[:, 1] .== 1, :]
        cand_e = intersect(unique(cand_e), empty_squares)
        return union(cand_o2, cand_m2, cand_m1, cand_o1, cand_e), "Other"
    end
end


function step(group_states, empty_squares, path, turn_color, is_player, depth, max_depth)
    num_node = 0
    if depth >= max_depth
        return [], [], num_node
    end
    opponent_color = turn_color == "black" ? "white" : "black"
    turn_cand, cat = get_candidates(turn_color, empty_squares, group_states, max_depth - depth - !is_player, is_player)
    all_forced_win_paths = []
    forced_win_cand = []
    for piece in turn_cand
        if (depth == max_depth - 1) & (cat != "Forced Win")
            continue
        end
        cp_empty = []
        for p in empty_squares
            if p != piece
                push!(cp_empty, p)
            end
        end
        cp_states = copy(group_states)
        update(cp_states, piece, turn_color)
        cp_path = copy(path)
#         push!(cp_path, string(turn_color, "-", piece - 1))
        push!(cp_path, piece)
        num_node += 1
        if is_player
            if cat == "Forced Win"
                push!(forced_win_cand, piece - 1)
                push!(all_forced_win_paths, cp_path)
                num_node += 1
            else
                next_fw_cand, next_all_fw_paths, n = step(cp_states, cp_empty, cp_path, opponent_color, false, depth+1, max_depth)
                num_node += n
                if length(next_fw_cand) > 0
                    push!(forced_win_cand, piece - 1)
                    append!(all_forced_win_paths, next_all_fw_paths)
                end
            end
        else
            if cat == "Forced Win"
                num_node += 1
                break
            end
            next_fw_cand, next_all_fw_paths, n = step(cp_states, cp_empty, cp_path, opponent_color, true, depth+1, max_depth)
            num_node += n
            if length(next_fw_cand) > 0
                push!(forced_win_cand, piece - 1)
                append!(all_forced_win_paths, next_all_fw_paths)
            else
                return [], [], num_node
            end
        end
    end
    return forced_win_cand, all_forced_win_paths, num_node
end


function search(black, white, max_depth)
    println(black)
    println(white)
    println(max_depth)
    @time begin
        player_color = length(black) == length(white) ? "black" : "white"
        group_states, empty_squares = init_state(black, white)
        forced_win_cand, all_forced_win_paths, num_node = step(group_states, empty_squares, [], player_color, true, 1, 2 * max_depth)
    end
    println(num_node)
    println(forced_win_cand)
    forced_win_tree = Dict()
    forced_win_tree["-1"] = []
    for path in all_forced_win_paths
        path = path .- 1
        buff = [path[1]]
        if path[1] ∉ forced_win_tree["-1"]
            push!(forced_win_tree["-1"], path[1])
        end
        for node in path[2:end]
            k = join(string.(buff), ",")
            if ~haskey(forced_win_tree, k)
                forced_win_tree[k] = []
            end
            if node ∉ forced_win_tree[k]
                push!(forced_win_tree[k], node)
            end
            push!(buff, node)
        end
        k = join(string.(buff), ",")
        forced_win_tree[k] = "terminal"
    end
    return forced_win_tree
end

function handle_request(req)
    headers = [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "POST",
        "Access-Control-Allow-Headers" => "Origin, Content-Type",
        "Content-Type" => "application/json",
        "Accept-Encoding" => "gzip, deflate, br, zstd"
    ]

    # Handle OPTIONS for CORS preflight
    if string(req.method) == "OPTIONS"
        return HTTP.Response(204, HTTP.Headers(headers))
    end
    if string(req.method) == "POST"
        try
            data = JSON.parse(String(req.body))
            result = search(data["black"], data["white"], data["win_in_n"])
            println(HTTP.Response(200, HTTP.Headers(headers); body=JSON.json(Dict("result" => result))))
            return HTTP.Response(200, HTTP.Headers(headers); body=JSON.json(Dict("result" => result)))
        catch e
            println(e)
            return HTTP.Response(400, JSON.json(Dict("error" => "Invalid data")))
        end
    else
        return HTTP.Response(405, JSON.json(Dict("error" => "Method not allowed")))
    end
end
# HTTP.serve(handle_request, "127.0.0.1", 1111)
println(Pkg.envdir())

